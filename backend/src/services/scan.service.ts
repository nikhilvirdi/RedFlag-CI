import { spawn } from 'child_process';
import path from 'path';
import { RiskLevel, ConfidenceLevel, RemediationType } from '@prisma/client';
import { logger } from '../utils/logger';
import {
    getInstallationOctokit,
    getPullRequestDiff,
    postPullRequestComment,
    setCommitStatus,
} from './github.service';
import { ScanJobData } from '../queues/scan.queue';
import { prisma } from '../config/db';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single vulnerability finding emitted by the Python scan engine.
 *
 * 💡 Why a strict interface?
 * The Python engine writes its output to stdout as a JSON string. When Node.js
 * receives that string, TypeScript has no way to know its shape at runtime.
 * By defining this interface and casting into it after parsing, we get
 * compile-time safety and editor autocomplete across all downstream code.
 */
export interface ScanFinding {
    type: 'credential' | 'sql_injection' | 'dependency' | 'prompt_injection';
    severity: 'critical' | 'high' | 'medium' | 'low';
    confidence: 'high' | 'medium' | 'low';
    file: string;        // Affected file path from the diff
    line: number;        // Line number within that file
    description: string; // Human-readable explanation of the vulnerability
    original_code: string;    // Vulnerable code snippet
    remediated_code?: string; // Auto-fixed version (only if deterministic fix exists)
    recommendation?: string;  // Guided fix steps (for complex issues)
}

/**
 * The complete output structure returned by the Python scan engine.
 *
 * 💡 Why separate findings from the score?
 * Separation of concerns — the Python engine calculates what was found and the
 * overall risk. Later, Node.js (this service) is responsible for formatting and
 * delivering those results. Neither layer knows about the other's implementation.
 */
export interface ScanEngineResult {
    findings: ScanFinding[];
    risk_score: number;        // 0–100 normalized score
    risk_classification: 'critical' | 'high' | 'medium' | 'low' | 'clean';
    summary: string;           // One-line human summary, e.g. "3 issues found (1 critical)"
}

// ─────────────────────────────────────────────────────────────────────────────
// PYTHON ENGINE BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spawns the Python scan engine as a child process, passes the diff via stdin,
 * and resolves with the structured JSON result from stdout.
 *
 * 💡 Why child_process.spawn() instead of exec()?
 * - `exec()` buffers ALL output in memory before returning it — dangerous for
 *   large diffs (megabytes of code). `spawn()` streams data via EventEmitters,
 *   so memory usage remains constant regardless of diff size.
 * - `spawn()` also allows us to write to the process's stdin (piping the diff
 *   directly to the Python process), which is cleaner than passing it as a
 *   CLI argument (which has OS-level argument length limits).
 *
 * 💡 Why communicate via JSON over stdin/stdout?
 * This is the standard "sidecar" pattern for polyglot systems. Node.js and Python
 * speak different languages but both understand JSON. Using stdout as the
 * communication channel means the scan engine can be replaced with ANY language
 * (Go, Rust, Ruby) in the future without changing this service — as long as
 * it emits the same JSON contract.
 */
async function runPythonScanEngine(diff: string): Promise<ScanEngineResult> {
    return new Promise((resolve, reject) => {

        // 💡 path.resolve() constructs an absolute path so Node.js can find
        // the Python script regardless of which directory the server is started from.
        const enginePath = path.resolve(__dirname, '../../scan-engine/main.py');

        logger.info(`Spawning Python scan engine at: ${enginePath}`);

        // spawn a child Python process.
        // - 'python' is the binary to execute (since python3 is not available on Windows).
        // - [enginePath] is the argument list (the script file).
        // - stdio: ['pipe', 'pipe', 'pipe'] opens writable stdin, readable stdout,
        //   and readable stderr as streams we can interact with programmatically.
        const pythonProcess = spawn('python', [enginePath], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdoutBuffer = '';
        let stderrBuffer = '';

        // Accumulate stdout chunks — the engine writes its JSON result here.
        pythonProcess.stdout.on('data', (chunk: Buffer) => {
            stdoutBuffer += chunk.toString();
        });

        // Accumulate stderr chunks — the engine writes its internal logs here.
        // We surface these as debug logs in our structured logger.
        pythonProcess.stderr.on('data', (chunk: Buffer) => {
            stderrBuffer += chunk.toString();
        });

        // The 'close' event fires when BOTH stdout and stderr have been fully
        // flushed and the child process has exited. Safe to parse output here.
        pythonProcess.on('close', (exitCode: number | null) => {
            if (stderrBuffer) {
                // Python's internal logs (not errors) come through stderr too.
                // Log at debug level so they don't pollute production output.
                logger.debug(`[Python Engine stderr]: ${stderrBuffer.trim()}`);
            }

            if (exitCode !== 0) {
                // Exit code non-zero = the Python process crashed.
                // BullMQ will automatically retry this job with exponential backoff.
                return reject(
                    new Error(`Python scan engine exited with code ${exitCode}. stderr: ${stderrBuffer.trim()}`)
                );
            }

            try {
                // Parse the JSON result emitted by the Python engine on stdout.
                const result: ScanEngineResult = JSON.parse(stdoutBuffer);
                resolve(result);
            } catch (parseError) {
                // If JSON.parse() throws, the engine emitted malformed output.
                // This is a contract violation — log the raw output for debugging.
                reject(
                    new Error(`Failed to parse Python engine output. Raw stdout: ${stdoutBuffer.substring(0, 500)}`)
                );
            }
        });

        // 'error' fires if Node.js cannot even start the process (e.g., 'python3'
        // not found in PATH). This is a hard infrastructure failure.
        pythonProcess.on('error', (err: Error) => {
            reject(new Error(`Failed to spawn Python process: ${err.message}`));
        });

        // Write the diff to the Python process's stdin and close the stream.
        // 💡 .end() signals EOF — without it, the Python process would block
        // forever waiting for more input and the promise would never resolve.
        pythonProcess.stdin.write(diff);
        pythonProcess.stdin.end();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts the raw engine result into a markdown-formatted string suitable
 * for posting as a GitHub PR comment.
 *
 * 💡 Why keep formatting in the service and not the worker?
 * The MVC principle applies here. The worker is a dispatcher — it only knows
 * WHEN to run a scan. The service knows HOW to process results. Keeping the
 * markdown here means if GitHub adds a new comment format tomorrow, only this
 * one function needs to change.
 */
function formatReportAsMarkdown(result: ScanEngineResult, repositoryFullName: string, pullRequestNumber: number): string {
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

    lines.push('*Powered by [RedFlag CI](https://github.com/nikhilvirdi/RedFlag-CI)*');
    return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR — called by the BullMQ Worker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The full end-to-end scan pipeline for a single PR.
 *
 * Execution order:
 *   1. Authenticate with GitHub via Installation Token
 *   2. Set commit status → "pending" (shows the yellow dot on the PR)
 *   3. Fetch the PR diff from GitHub
 *   4. Pass the diff to the Python scan engine
 *   5. Format the findings as a GitHub markdown comment
 *   6. Post the comment to the PR
 *   7. Update the commit status → "success" or "failure" (green tick / red cross)
 *
 * 💡 Why is this function the ONLY export besides types?
 * The worker should be a dumb consumer — it has zero knowledge of GitHub,
 * Python, or markdown. It delegates ALL of that complexity to this single
 * function. This is the "Façade" design pattern: one clean surface hiding
 * multiple complex subsystems behind it.
 */
export async function runScanPipeline(jobData: ScanJobData): Promise<void> {
    const { installationId, repositoryFullName, pullRequestNumber, headSha } = jobData;
    const [owner, repo] = repositoryFullName.split('/');

    logger.info(`[ScanService] Pipeline started — ${repositoryFullName} PR #${pullRequestNumber} @ ${headSha.slice(0, 7)}`);

    // ── STEP 1: Authenticate ────────────────────────────────────────────────
    // Get an Octokit client authenticated for this specific GitHub installation.
    // Each call generates a fresh short-lived Installation Token automatically.
    const octokit = await getInstallationOctokit(installationId);

    // ── STEP 2: Set Commit Status → Pending ─────────────────────────────────
    // This sets the yellow "pending" dot on the PR immediately.
    // 💡 Without this, the developer has no feedback that a scan is running.
    //    They might merge before the scan completes thinking everything is fine.
    await setCommitStatus(octokit, owner, repo, headSha, 'pending', 'RedFlag CI scan in progress…');
    logger.info(`[ScanService] Commit status set to [pending]`);

    // ── STEP 3: Fetch the PR Diff ───────────────────────────────────────────
    // Downloads only the lines that changed in this PR — not the entire codebase.
    // 💡 Incremental processing: scanning only the diff is faster, cheaper, and
    //    more accurate because we focus only on what the developer actually wrote.
    const diff = await getPullRequestDiff(octokit, owner, repo, pullRequestNumber);
    logger.info(`[ScanService] PR diff fetched. Size: ${diff.length} bytes`);

    // ── STEP 4: Run the Python Scan Engine ──────────────────────────────────
    // Pipe the diff to the Python engine and wait for the structured JSON result.
    const scanResult = await runPythonScanEngine(diff);
    logger.info(`[ScanService] Scan complete. Score: ${scanResult.risk_score}/100, Classification: ${scanResult.risk_classification}, Findings: ${scanResult.findings.length}`);

    // ── STEP 4.5: Persist Results to PostgreSQL ──────────────────────────────
    // We save results BEFORE posting the comment so that even if the GitHub
    // API call fails (network blip, rate limit), our data is already safe.
    //
    // 💡 Why a try/catch here instead of letting it throw?
    // A database write failure must NEVER block the developer from receiving
    // their PR comment — that would defeat the core purpose of the system.
    // We log the error and continue, preserving the UX while alerting on-call.
    //
    // 💡 How Prisma nested writes work:
    // Instead of 4 separate INSERT queries (ScanResult, RiskScore, per-Finding,
    // per-Remediation), Prisma lets us describe the entire object tree in one
    // call. It compiles this down into a transaction — either everything is
    // saved, or nothing is (atomicity). No need for manual BEGIN/COMMIT/ROLLBACK.
    try {
        // ── Map Python engine string values to Prisma enum values ────────
        // The Python engine emits strings like 'critical', 'high', 'medium', 'low', 'clean'.
        // Prisma enums are uppercase: CRITICAL, HIGH, etc.
        // We map them here at the boundary so the rest of the codebase stays clean.
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

        await prisma.scanResult.create({
            data: {
                pullRequestId: String(pullRequestNumber),
                commitSha:     headSha,
                status:        'COMPLETED',

                // ── Nested write: RiskScore (1-to-1 with ScanResult) ───
                // 'create' here tells Prisma to INSERT a new RiskScore row
                // and automatically set its scanResultId foreign key.
                riskScore: {
                    create: {
                        totalScore:       scanResult.risk_score,
                        classification:   riskLevelMap[scanResult.risk_classification] ?? RiskLevel.CLEAN,
                        contributionData: {
                            // Breakdown stored as JSON for analytics queries later
                            total_findings: scanResult.findings.length,
                            by_severity: scanResult.findings.reduce((acc, f) => {
                                acc[f.severity] = (acc[f.severity] ?? 0) + 1;
                                return acc;
                            }, {} as Record<string, number>),
                        },
                    },
                },

                // ── Nested write: Findings (1-to-many with ScanResult) ─
                // 'createMany' inserts all findings in a single batch INSERT.
                // Each finding also creates its own Remediation via a nested write.
                findings: {
                    create: scanResult.findings.map((finding) => ({
                        category:    finding.type,
                        description: finding.description,
                        file:        finding.file,
                        lineNumber:  finding.line,
                        severity:    riskLevelMap[finding.severity] ?? RiskLevel.LOW,
                        confidence:  confidenceMap[finding.confidence] ?? ConfidenceLevel.LOW,
                        codeSnippet: finding.original_code,

                        // ── Nested write: Remediation (1-to-1 with Finding) ─
                        // Only created if the finding has at least one of these fields.
                        // 💡 'create' inside 'findings.create' nests three levels deep —
                        // Prisma handles the FK chaining (finding.id → remediation.findingId) automatically.
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

                // ── Repository connection ─────────────────────────────────
                // 💡 Why findFirst + connect by ID?
                // The repository row must already exist. 'connect' requires a @unique field.
                // Since fullName is not @unique in schema.prisma, we look it up first.
                repository: {
                    connect: { id: (await prisma.repository.findFirst({ where: { fullName: repositoryFullName } }))?.id || '' },
                },
            },
        });

        logger.info(`[ScanService] Results persisted to database for PR #${pullRequestNumber}.`);
    } catch (dbError) {
        // Non-fatal — log and continue so the GitHub comment is still posted.
        logger.error('[ScanService] Failed to persist scan results to database.', { error: dbError });
    }

    // ── STEP 5 & 6: Format and Post the PR Comment ──────────────────────────
    // Convert raw findings into a readable markdown report and post it.
    const markdownReport = formatReportAsMarkdown(scanResult, repositoryFullName, pullRequestNumber);
    await postPullRequestComment(octokit, owner, repo, pullRequestNumber, markdownReport);
    logger.info(`[ScanService] Report posted to PR #${pullRequestNumber}`);

    // ── STEP 7: Update Commit Status → Final Result ─────────────────────────
    // Set the green tick (success) or red cross (failure) on the commit.
    // 💡 The threshold: a risk_score ≥ 70 is treated as a failure.
    //    This is the number that blocks merging in protected branch rules.
    const finalState = scanResult.risk_score >= 70 ? 'failure' : 'success';
    const finalDescription = finalState === 'failure'
        ? `${scanResult.findings.length} issue(s) detected. Score: ${scanResult.risk_score}/100`
        : `Scan passed. Score: ${scanResult.risk_score}/100`;

    await setCommitStatus(octokit, owner, repo, headSha, finalState, finalDescription);
    logger.info(`[ScanService] Pipeline complete. Final commit status: [${finalState}]`);
}
