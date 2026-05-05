import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ScanFinding } from './scan.service';

const MAX_FINDINGS_PER_SCAN = 10;

const SYSTEM_PROMPT = `You are a security remediation engine. You will be given a vulnerable code snippet and a description of the vulnerability. Your response must contain exactly two lines:
Line 1: The complete corrected code that replaces the vulnerable snippet, with no surrounding context, markdown, or explanation.
Line 2: A single-sentence recommendation of no more than 20 words.
Output nothing else.`;

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

async function remediateSingleFinding(finding: ScanFinding): Promise<void> {
    const userMessage = `Vulnerability: ${finding.description}\nVulnerable code:\n${finding.original_code}`;

    const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 16000,
        thinking: {
            type: 'enabled',
            budget_tokens: 10000,
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return;

    const lines = textBlock.text.trim().split('\n').filter((l) => l.trim().length > 0);
    if (lines.length >= 1) finding.remediated_code = lines[0].trim();
    if (lines.length >= 2) finding.recommendation = lines[1].trim();
}

export async function remediateFindings(findings: ScanFinding[]): Promise<ScanFinding[]> {
    const eligible = findings
        .filter((f) => (f.severity === 'high' || f.severity === 'critical') && f.confidence === 'high')
        .slice(0, MAX_FINDINGS_PER_SCAN);

    if (eligible.length === 0) {
        logger.info('[Remediation] No eligible findings for LLM remediation.');
        return findings;
    }

    logger.info(`[Remediation] Sending ${eligible.length} finding(s) to Claude for remediation.`);

    const results = await Promise.allSettled(
        eligible.map((finding) => remediateSingleFinding(finding))
    );

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            logger.error(`[Remediation] Failed to remediate finding #${index + 1}: ${result.reason}`);
        }
    });

    return findings;
}
