import { spawn } from 'child_process';
import path from 'path';
import { RiskLevel, ConfidenceLevel, RemediationType } from '@prisma/client';
import { logger } from '../utils/logger';
import {
    getInstallationOctokit,
    getPullRequestDiff,
    postPullRequestComment,
    setCommitStatus,
    getFileContent,
    createBranch,
    createBlob,
    createTree,
    createCommit,
    updateRef,
    createPullRequest
} from './github.service';
import { ScanJobData } from '../queues/scan.queue';
import { prisma } from '../config/db';
import { remediateFindings } from './remediation.service';
import { chainFindings, VulnerabilityChain } from './chaining.service';
import { detectRegressions, storeEmbeddings } from './memory.service';

export interface ScanFinding {
    type: 'credential' | 'sql_injection' | 'dependency' | 'prompt_injection';
    severity: 'critical' | 'high' | 'medium' | 'low';
    confidence: 'high' | 'medium' | 'low';
    file: string;
    line: number;
    description: string;
    original_code: string;
    remediated_code?: string;
    recommendation?: string;
    isRegression?: boolean;
}

export interface ScanEngineResult {
    findings: ScanFinding[];
    risk_score: number;
    risk_classification: 'critical' | 'high' | 'medium' | 'low' | 'clean';
    summary: string;
}

async function runPythonScanEngine(diff: string): Promise<ScanEngineResult> {
    return new Promise((resolve, reject) => {
        const enginePath = path.resolve(__dirname, '../../scan-engine/main.py');
        logger.info(`Spawning Python scan engine at: ${enginePath}`);

        const pythonProcess = spawn('python3', [enginePath], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdoutBuffer = '';
        let stderrBuffer = '';

        pythonProcess.stdout.on('data', (chunk: Buffer) => {
            stdoutBuffer += chunk.toString();
        });

        pythonProcess.stderr.on('data', (chunk: Buffer) => {
            stderrBuffer += chunk.toString();
        });

        pythonProcess.on('close', (exitCode: number | null) => {
            if (stderrBuffer) {
                logger.debug(`[Python Engine stderr]: ${stderrBuffer.trim()}`);
            }

            if (exitCode !== 0) {
                return reject(
                    new Error(`Python scan engine exited with code ${exitCode}. stderr: ${stderrBuffer.trim()}`)
                );
            }

            try {
                const result: ScanEngineResult = JSON.parse(stdoutBuffer);
                resolve(result);
            } catch (parseError) {
                reject(
                    new Error(`Failed to parse Python engine output. Raw stdout: ${stdoutBuffer.substring(0, 500)}`)
                );
            }
        });

        pythonProcess.on('error', (err: Error) => {
            reject(new Error(`Failed to spawn Python process: ${err.message}`));
        });

        pythonProcess.stdin.write(diff);
        pythonProcess.stdin.end();
    });
}

function formatReportAsMarkdown(result: ScanEngineResult, repositoryFullName: string, pullRequestNumber: number, fixPrUrl: string | null): string {
    const SEVERITY_EMOJI: Record<string, string> = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🔵',
        clean: '✅',
    };

    const emoji = SEVERITY_EMOJI[result.risk_classification] ?? '⚪';

    const lines: string[] = [
        `## ${emoji} RedFlag CI — Security Scan Report`,
        `> **Repository:** \`${repositoryFullName}\` | **PR:** #${pullRequestNumber}`,
        '',
        `### 📊 Risk Summary`,
        `| Metric | Value |`,
        `|---|---|`,
        `| **Risk Score** | \`${result.risk_score} / 100\` |`,
        `| **Classification** | \`${result.risk_classification.toUpperCase()}\` |`,
        `| **Findings** | \`${result.findings.length}\` |`,
        `| **Summary** | ${result.summary} |`,
        '',
    ];

    if (result.findings.length === 0) {
        lines.push('### ✅ No vulnerabilities detected. Great work!');
        return lines.join('\n');
    }

    lines.push('---', '### 🛡️ Identified Issues', '');

    result.findings.forEach((finding, index) => {
        const severityEmoji = SEVERITY_EMOJI[finding.severity] ?? '⚪';
        lines.push(
            `#### ${index + 1}. ${severityEmoji} ${finding.type.replace('_', ' ').toUpperCase()} — \`${finding.file}:${finding.line}\``,
            '',
            `**Severity:** \`${finding.severity}\` | **Confidence:** \`${finding.confidence}\``,
            '',
            `**Description:** ${finding.description}`,
            '',
            '**Vulnerable Code:**',
            '```',
            finding.original_code,
            '```',
            '',
        );

        if (finding.remediated_code) {
            lines.push(
                '**Auto-Remediated Code (apply this fix):**',
                '```',
                finding.remediated_code,
                '```',
                '',
            );
        }

        if (finding.recommendation) {
            lines.push(
                `**Recommendation:** ${finding.recommendation}`,
                '',
            );
        }

        lines.push('---', '');
    });

    if (fixPrUrl) {
        lines.push(
            '---',
            '### 🛠️ Auto-Fix Available!',
            'RedFlag CI has automatically generated a Pull Request with the recommended fixes.',
            `👉 **[Review and merge the Auto-Fix PR here](${fixPrUrl})**`,
            ''
        );
    }

    lines.push('*Powered by [RedFlag CI](https://github.com/nikhilvirdi/RedFlag-CI)*');
    return lines.join('\n');
}

async function applyAutoFixes(
    octokit: any,
    owner: string,
    repo: string,
    pullRequestNumber: number,
    headSha: string,
    findings: ScanFinding[]
): Promise<string | null> {
    const findingsWithFix = findings.filter(f => f.remediated_code);
    if (findingsWithFix.length === 0) return null;

    logger.info(`[AutoFix] Found ${findingsWithFix.length} findings with automated fixes.`);
    
    let anyFixesApplied = false;
    const newTreeItems: Array<{
        path: string;
        mode: '100644' | '100755' | '040000' | '160000' | '120000';
        type: 'blob' | 'tree' | 'commit';
        sha: string;
    }> = [];
    const filesToProcess = Array.from(new Set(findingsWithFix.map(f => f.file)));

    for (const file of filesToProcess) {
        try {
            let content = await getFileContent(octokit, owner, repo, file, headSha);
            const fileFindings = findingsWithFix.filter(f => f.file === file);
            let modified = false;

            for (const finding of fileFindings) {
                if (finding.remediated_code && content.includes(finding.original_code)) {
                    content = content.replace(finding.original_code, finding.remediated_code);
                    modified = true;
                } else {
                    logger.warn(`[AutoFix] Could not apply fix in ${file}: original code not found exactly as reported.`);
                }
            }

            if (modified) {
                const blobSha = await createBlob(octokit, owner, repo, content);
                newTreeItems.push({
                    path: file,
                    mode: '100644',
                    type: 'blob',
                    sha: blobSha,
                });
                anyFixesApplied = true;
            }
        } catch (e) {
            logger.error(`[AutoFix] Failed to process file ${file}`, { error: e });
        }
    }

    if (!anyFixesApplied) {
        return null;
    }

    try {
        const prResponse = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner,
            repo,
            pull_number: pullRequestNumber,
        });
        const headRef = prResponse.data.head.ref;

        const commitResponse = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
            owner,
            repo,
            ref: headSha,
        });
        const baseTreeSha = commitResponse.data.commit.tree.sha;

        const newTreeSha = await createTree(octokit, owner, repo, baseTreeSha, newTreeItems);
        const commitMessage = `Auto-fix from RedFlag CI for PR #${pullRequestNumber}\n\nApplies security remediations detected by RedFlag CI.`;
        const commitSha = await createCommit(octokit, owner, repo, commitMessage, newTreeSha, [headSha]);

        const branchName = `redflag-fix/pr-${pullRequestNumber}-${headSha.slice(0, 7)}`;
        await createBranch(octokit, owner, repo, branchName, headSha);
        await updateRef(octokit, owner, repo, `heads/${branchName}`, commitSha);

        const prTitle = `🛡️ Auto-fix: RedFlag CI Security Remediations (PR #${pullRequestNumber})`;
        const prBody = `This PR was automatically generated by RedFlag CI to remediate security vulnerabilities found in PR #${pullRequestNumber}.\n\nPlease review the changes before merging into your branch.`;
        
        const pr = await createPullRequest(octokit, owner, repo, prTitle, branchName, headRef, prBody);
        logger.info(`[AutoFix] Successfully opened auto-fix PR: ${pr.html_url}`);
        return pr.html_url;

    } catch (e) {
        logger.error(`[AutoFix] Failed to create branch or PR`, { error: e });
        return null;
    }
}

export async function runScanPipeline(jobData: ScanJobData): Promise<void> {
    const { installationId, repositoryFullName, pullRequestNumber, headSha } = jobData;
    const [owner, repo] = repositoryFullName.split('/');

    logger.info(`[ScanService] Pipeline started — ${repositoryFullName} PR #${pullRequestNumber} @ ${headSha.slice(0, 7)}`);

    const octokit = await getInstallationOctokit(installationId);

    await setCommitStatus(octokit, owner, repo, headSha, 'pending', 'RedFlag CI scan in progress…');
    logger.info(`[ScanService] Commit status set to [pending]`);

    const diff = await getPullRequestDiff(octokit, owner, repo, pullRequestNumber);
    logger.info(`[ScanService] PR diff fetched. Size: ${diff.length} bytes`);

    const scanResult = await runPythonScanEngine(diff);
    logger.info(`[ScanService] Scan complete. Score: ${scanResult.risk_score}/100, Classification: ${scanResult.risk_classification}, Findings: ${scanResult.findings.length}`);

    scanResult.findings = await remediateFindings(scanResult.findings);
    logger.info(`[ScanService] LLM remediation complete.`);

    const chains: VulnerabilityChain[] = chainFindings(scanResult.findings);

    const repoRecord = await prisma.repository.findFirst({ where: { fullName: repositoryFullName } });

    if (repoRecord) {
        await detectRegressions(scanResult.findings, repoRecord.id);
    }

    try {
        if (!repoRecord) {
            throw new Error(`Repository ${repositoryFullName} not found. Cannot persist scan result.`);
        }

        const riskLevelMap: Record<string, RiskLevel> = {
            critical: RiskLevel.CRITICAL,
            high:     RiskLevel.HIGH,
            medium:   RiskLevel.MEDIUM,
            low:      RiskLevel.LOW,
            clean:    RiskLevel.CLEAN,
        };

        const confidenceMap: Record<string, ConfidenceLevel> = {
            high:   ConfidenceLevel.HIGH,
            medium: ConfidenceLevel.MEDIUM,
            low:    ConfidenceLevel.LOW,
        };

        const dbScanResult = await prisma.scanResult.create({
            data: {
                pullRequestId: String(pullRequestNumber),
                commitSha:     headSha,
                status:        'COMPLETED',

                riskScore: {
                    create: {
                        totalScore:       scanResult.risk_score,
                        classification:   riskLevelMap[scanResult.risk_classification] ?? RiskLevel.CLEAN,
                        contributionData: {
                            total_findings: scanResult.findings.length,
                            by_severity: scanResult.findings.reduce((acc, f) => {
                                acc[f.severity] = (acc[f.severity] ?? 0) + 1;
                                return acc;
                            }, {} as Record<string, number>),
                            chains,
                        },
                    },
                },

                findings: {
                    create: scanResult.findings.map((finding) => ({
                        category:    finding.type,
                        description: finding.description,
                        file:        finding.file,
                        lineNumber:  finding.line,
                        severity:    riskLevelMap[finding.severity] ?? RiskLevel.LOW,
                        confidence:  confidenceMap[finding.confidence] ?? ConfidenceLevel.LOW,
                        codeSnippet: finding.original_code,

                        remediation: (finding.remediated_code || finding.recommendation)
                            ? {
                                create: {
                                    type:           finding.remediated_code ? RemediationType.AUTOMATIC : RemediationType.GUIDED,
                                    correctedCode:  finding.remediated_code ?? null,
                                    recommendation: finding.recommendation  ?? null,
                                },
                            }
                            : undefined,
                    })),
                },

                repository: {
                    connect: { id: repoRecord.id },
                },
            },
        });

        logger.info(`[ScanService] Results persisted to database for PR #${pullRequestNumber}.`);

        try {
            await storeEmbeddings(scanResult.findings, repoRecord.id, dbScanResult.id);
            logger.info(`[ScanService] Embeddings stored for ${scanResult.findings.length} finding(s).`);
        } catch (memError) {
            logger.warn('[ScanService] Embedding storage failed — memory features degraded.', { error: memError });
        }
    } catch (dbError) {
        logger.error('[ScanService] Failed to persist scan results to database.', { error: dbError });
    }

    const fixPrUrl = await applyAutoFixes(octokit, owner, repo, pullRequestNumber, headSha, scanResult.findings);

    const markdownReport = formatReportAsMarkdown(scanResult, repositoryFullName, pullRequestNumber, fixPrUrl);
    await postPullRequestComment(octokit, owner, repo, pullRequestNumber, markdownReport);
    logger.info(`[ScanService] Report posted to PR #${pullRequestNumber}`);

    const finalState = scanResult.risk_score >= 70 ? 'failure' : 'success';
    const finalDescription = finalState === 'failure'
        ? `${scanResult.findings.length} issue(s) detected. Score: ${scanResult.risk_score}/100`
        : `Scan passed. Score: ${scanResult.risk_score}/100`;

    await setCommitStatus(octokit, owner, repo, headSha, finalState, finalDescription);
    logger.info(`[ScanService] Pipeline complete. Final commit status: [${finalState}]`);
}
