import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ScanFinding } from './scan.service';
import { canCallClaude, recordClaudeUsage, tripCircuitBreaker } from './claudeRateLimit.service';

const MAX_FINDINGS_PER_SCAN = 10;
const MAX_TOKENS_PER_CALL = 4096;

const SYSTEM_PROMPT = `You are a security remediation engine. You will be given a vulnerable code snippet and a description of the vulnerability. Your response must contain exactly two lines:
Line 1: The complete corrected code that replaces the vulnerable snippet, with no surrounding context, markdown, or explanation.
Line 2: A single-sentence recommendation of no more than 20 words.
Output nothing else.`;

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;

async function remediateSingleFinding(finding: ScanFinding): Promise<void> {
    const check = await canCallClaude();
    if (!check.allowed) {
        logger.warn(`[Remediation] Claude rate limit: ${check.reason}`);
        return;
    }

    const userMessage = `Vulnerability: ${finding.description}\nVulnerable code:\n${finding.original_code}`;

    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: MAX_TOKENS_PER_CALL,
            thinking: {
                type: 'enabled',
                budget_tokens: 10000,
            },
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMessage }],
        });

        const totalTokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
        await recordClaudeUsage(totalTokens);

        consecutiveFailures = 0;

        const textBlock = response.content.find((block) => block.type === 'text');
        if (!textBlock || textBlock.type !== 'text') return;

        const lines = textBlock.text.trim().split('\n').filter((l) => l.trim().length > 0);
        if (lines.length >= 1) finding.remediated_code = lines[0].trim();
        if (lines.length >= 2) finding.recommendation = lines[1].trim();
    } catch (error: any) {
        consecutiveFailures++;

        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            await tripCircuitBreaker(`${consecutiveFailures} consecutive failures: ${error.message}`);
            consecutiveFailures = 0;
        }

        if (error.status === 429) {
            await tripCircuitBreaker('Claude API returned 429 Too Many Requests');
        }

        throw error;
    }
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
