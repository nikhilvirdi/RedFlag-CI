import { GitHubApp, getChangedFiles } from './githubApp';
import { filterMonitoredFiles } from './monitoredFiles';
import { getFileVersions } from './fileVersions';
import { detectNewMcpServer } from './detectors/newMcpServer';
import { detectSwappedMcpServer } from './detectors/swappedMcpServer';
import { detectWidenedPermissions } from './detectors/widenedPermissions';
import { detectHookChanged } from './detectors/hookChanged';
import { detectInvisibleUnicode } from './detectors/invisibleUnicode';
import { detectHomoglyphs } from './detectors/homoglyphs';
import { aggregateFindings } from './aggregateFindings';
import { postFindings } from './postFindings';
import { Finding } from './types';

const PROCESSED_ACTIONS = new Set(['opened', 'synchronize']);

// TODO(diagnostic-logging): temporary console.log instrumentation added to
// track down why DD-1 isn't firing on a real webhook. architecture.md lists
// Winston as the intended logger, but it isn't installed yet (see
// package.json) so this uses console.log per the task's explicit fallback.
// Remove or replace with real logging once the root cause is found.
const LOG_PREFIX = '[RedFlag CI diagnostic]';

interface WebhookPullRequestPayload {
  action?: unknown;
  pull_request?: {
    number?: unknown;
    head?: { sha?: unknown };
    base?: { sha?: unknown };
  };
  repository?: {
    name?: unknown;
    owner?: { login?: unknown };
  };
  installation?: { id?: unknown };
}

interface ParsedPullRequestEvent {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  baseRef: string;
  headRef: string;
  installationId: number;
}

function describeContent(content: string | null): { status: 'null' | 'empty' | 'populated'; length: number } {
  if (content === null) {
    return { status: 'null', length: 0 };
  }
  if (content.length === 0) {
    return { status: 'empty', length: 0 };
  }
  return { status: 'populated', length: content.length };
}

// Untrusted webhook payload: only proceed on an opened/synchronize
// pull_request event that has every field the rest of the pipeline needs.
// Anything else (other event types, other actions, malformed bodies) is
// silently ignored, matching architecture.md's fail-open, quiet-by-default
// stance rather than erroring on shapes we don't recognize.
function parsePullRequestEvent(payload: unknown): ParsedPullRequestEvent | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const p = payload as WebhookPullRequestPayload;
  const action = p.action;
  const owner = p.repository?.owner?.login;
  const repo = p.repository?.name;
  const pullNumber = p.pull_request?.number;
  const headSha = p.pull_request?.head?.sha;
  const baseSha = p.pull_request?.base?.sha;
  const installationId = p.installation?.id;

  if (
    typeof action !== 'string' ||
    !PROCESSED_ACTIONS.has(action) ||
    typeof owner !== 'string' ||
    typeof repo !== 'string' ||
    typeof pullNumber !== 'number' ||
    typeof headSha !== 'string' ||
    typeof baseSha !== 'string' ||
    typeof installationId !== 'number'
  ) {
    return null;
  }

  return { owner, repo, pullNumber, headSha, baseRef: baseSha, headRef: headSha, installationId };
}

function runDiffDriftDetectors(filePath: string, base: string | null, head: string | null): Finding[] {
  const newMcpServerFindings = detectNewMcpServer(filePath, base, head);
  console.log(`${LOG_PREFIX} detectNewMcpServer`, { path: filePath, findings: newMcpServerFindings });

  const swappedMcpServerFindings = detectSwappedMcpServer(filePath, base, head);
  console.log(`${LOG_PREFIX} detectSwappedMcpServer`, { path: filePath, findings: swappedMcpServerFindings });

  const widenedPermissionsFindings = detectWidenedPermissions(filePath, base, head);
  console.log(`${LOG_PREFIX} detectWidenedPermissions`, {
    path: filePath,
    findings: widenedPermissionsFindings,
  });

  const hookChangedFindings = detectHookChanged(filePath, base, head);
  console.log(`${LOG_PREFIX} detectHookChanged`, { path: filePath, findings: hookChangedFindings });

  return [
    ...newMcpServerFindings,
    ...swappedMcpServerFindings,
    ...widenedPermissionsFindings,
    ...hookChangedFindings,
  ];
}

function runRuleFileDetectors(filePath: string, head: string | null): Finding[] {
  if (head === null) {
    return [];
  }

  const invisibleUnicodeFindings = detectInvisibleUnicode(filePath, head);
  console.log(`${LOG_PREFIX} detectInvisibleUnicode`, { path: filePath, findings: invisibleUnicodeFindings });

  const homoglyphFindings = detectHomoglyphs(filePath, head);
  console.log(`${LOG_PREFIX} detectHomoglyphs`, { path: filePath, findings: homoglyphFindings });

  return [...invisibleUnicodeFindings, ...homoglyphFindings];
}

export async function processPullRequestEvent(githubApp: GitHubApp, payload: unknown): Promise<void> {
  // Stage 1: log the incoming webhook payload's action and PR number, using
  // best-effort raw extraction (not the strict parse) so this still prints
  // even when the payload fails validation below — that failure is itself a
  // prime suspect for "findings never run at all".
  const rawAction = (payload as WebhookPullRequestPayload | null)?.action;
  const rawPullNumber = (payload as WebhookPullRequestPayload | null)?.pull_request?.number;
  console.log(`${LOG_PREFIX} webhook payload received`, { action: rawAction, pullNumber: rawPullNumber });

  const event = parsePullRequestEvent(payload);
  if (!event) {
    console.log(`${LOG_PREFIX} payload did not parse as a processable pull_request event; skipping`, {
      action: rawAction,
      pullNumber: rawPullNumber,
    });
    return;
  }

  const { owner, repo, pullNumber, headSha, baseRef, headRef, installationId } = event;

  // Stage 2: the list of changed files returned by getChangedFiles.
  const changedFiles = await getChangedFiles(githubApp, { installationId, owner, repo, pullNumber });
  console.log(`${LOG_PREFIX} changed files`, { owner, repo, pullNumber, changedFiles });

  // Stage 3: filterMonitoredFiles' result — which files matched, which engine.
  const { matches } = filterMonitoredFiles(changedFiles);
  console.log(`${LOG_PREFIX} monitored file matches`, {
    pullNumber,
    matches: matches.map((m) => ({ path: m.path, engine: m.engine })),
  });

  let findings: Finding[] = [];
  if (matches.length > 0) {
    const findingsBySource = await Promise.all(
      matches.map(async (match) => {
        const { base, head } = await getFileVersions(githubApp, {
          installationId,
          owner,
          repo,
          path: match.path,
          baseRef,
          headRef,
        });

        // Stage 4: base/head content lengths (not full content) per matched file.
        console.log(`${LOG_PREFIX} file versions fetched`, {
          path: match.path,
          engine: match.engine,
          base: describeContent(base),
          head: describeContent(head),
        });

        // Stage 5: each individual detector's findings are logged inside
        // runDiffDriftDetectors / runRuleFileDetectors, per detector call.
        return match.engine === 'diff-drift'
          ? runDiffDriftDetectors(match.path, base, head)
          : runRuleFileDetectors(match.path, head);
      })
    );

    findings = aggregateFindings(findingsBySource);
  }

  // Stage 6: final aggregated findings array length before postFindings runs.
  console.log(`${LOG_PREFIX} final aggregated findings`, { pullNumber, count: findings.length });

  const octokit = await githubApp.getInstallationOctokit(installationId);
  await postFindings(octokit, { owner, repo, pullNumber, headSha, findings });
}
