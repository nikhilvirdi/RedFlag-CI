import { GitHubApp, getChangedFiles } from './githubApp';
import { filterMonitoredFiles } from './monitoredFiles';
import { getFileVersions } from './fileVersions';
import { detectNewMcpServer } from './detectors/newMcpServer';
import { detectSwappedMcpServer } from './detectors/swappedMcpServer';
import { detectWidenedPermissions } from './detectors/widenedPermissions';
import { detectHookChanged } from './detectors/hookChanged';
import { detectUnpinnedMcpDependency } from './detectors/unpinnedMcpDependency';
import { detectObfuscatedCommand } from './detectors/obfuscatedCommand';
import { detectDuplicateJsonKey } from './detectors/duplicateJsonKey';
import { detectSuspiciousNetworkTarget } from './detectors/suspiciousNetworkTarget';
import { detectPathTraversal } from './detectors/pathTraversal';
import { detectTransportTypeChange } from './detectors/transportTypeChange';
import { detectInvisibleUnicode } from './detectors/invisibleUnicode';
import { detectHomoglyphs } from './detectors/homoglyphs';
import { detectRuleFileChecksInJsonKeys } from './detectors/ruleFileJsonKeys';
import { aggregateFindings } from './aggregateFindings';
import { postFindings } from './postFindings';
import { updateBaselineOnMerge, MergeEvent } from './baselineUpdate';
import { readBaseline } from './baseline';
import { detectCumulativeDrift } from './cumulativeDrift';
import { Finding } from './types';

const PROCESSED_ACTIONS = new Set(['opened', 'synchronize']);

interface WebhookPullRequestPayload {
  action?: unknown;
  pull_request?: {
    number?: unknown;
    head?: { sha?: unknown };
    base?: { sha?: unknown };
    merged?: unknown;
    merge_commit_sha?: unknown;
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

// Task A.2: the baseline must update only on an actual merge, never on
// open/synchronize, and never for a PR that was closed without merging (an
// unmerged PR must never influence the stored baseline, even indirectly).
//
// Signal chosen: the pull_request webhook event, action "closed" with
// pull_request.merged === true -- not a push event to the base branch.
// A push event fires for ANY commit landing on that branch (a direct push,
// a force-push, a merge done outside a reviewed PR), not only a genuine PR
// merge, and carries no PR number to correlate back to one; distinguishing
// "was this actually a merged PR" from "something else changed this branch"
// would mean re-deriving the same signal pull_request/closed already gives
// directly. The merge commit's own SHA (merge_commit_sha) is used as the
// ref to snapshot, not the base branch name, so a second merge landing
// between event delivery and this handler running can't shift what gets
// captured out from under it.
function parseMergeEvent(payload: unknown): MergeEvent | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const p = payload as WebhookPullRequestPayload;
  if (p.action !== 'closed' || p.pull_request?.merged !== true) {
    return null;
  }

  const owner = p.repository?.owner?.login;
  const repo = p.repository?.name;
  const mergeCommitSha = p.pull_request?.merge_commit_sha;
  const installationId = p.installation?.id;

  if (
    typeof owner !== 'string' ||
    typeof repo !== 'string' ||
    typeof mergeCommitSha !== 'string' ||
    typeof installationId !== 'number'
  ) {
    return null;
  }

  return { owner, repo, mergeCommitSha, installationId };
}

function runDiffDriftDetectors(filePath: string, base: string | null, head: string | null): Finding[] {
  return [
    ...detectNewMcpServer(filePath, base, head),
    ...detectSwappedMcpServer(filePath, base, head),
    ...detectWidenedPermissions(filePath, base, head),
    ...detectHookChanged(filePath, base, head),
    ...detectUnpinnedMcpDependency(filePath, head),
    ...detectObfuscatedCommand(filePath, head),
    ...detectDuplicateJsonKey(filePath, head),
    ...detectSuspiciousNetworkTarget(filePath, head),
    ...detectPathTraversal(filePath, head),
    ...detectTransportTypeChange(filePath, base, head),
    ...detectRuleFileChecksInJsonKeys(filePath, head),
  ];
}

function runRuleFileDetectors(filePath: string, head: string | null): Finding[] {
  if (head === null) {
    return [];
  }
  return [...detectInvisibleUnicode(filePath, head), ...detectHomoglyphs(filePath, head)];
}

export async function processPullRequestEvent(githubApp: GitHubApp, payload: unknown): Promise<void> {
  const mergeEvent = parseMergeEvent(payload);
  if (mergeEvent) {
    await updateBaselineOnMerge(githubApp, mergeEvent);
    return;
  }

  const event = parsePullRequestEvent(payload);
  if (!event) {
    return;
  }

  const { owner, repo, pullNumber, headSha, baseRef, headRef, installationId } = event;

  const changedFiles = await getChangedFiles(githubApp, { installationId, owner, repo, pullNumber });
  const { matches } = filterMonitoredFiles(changedFiles);

  let findings: Finding[] = [];
  if (matches.length > 0) {
    const octokit = await githubApp.getInstallationOctokit(installationId);
    // Task A.3: fail-open by construction -- readBaseline already collapses
    // a missing baseline branch, a missing file, malformed content, or any
    // other API failure to null, so a repo with no baseline yet (or one
    // RedFlag CI temporarily can't reach) falls straight through to today's
    // stateless, single-PR comparison below with no special-casing needed
    // here.
    const baseline = await readBaseline(octokit, { owner, repo });

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

        const immediateFindings =
          match.engine === 'diff-drift'
            ? runDiffDriftDetectors(match.path, base, head)
            : runRuleFileDetectors(match.path, head);

        // Cumulative drift only applies to diff-drift files with a known
        // baseline entry; a file the baseline has never captured (new to
        // this repo's monitored set, or the baseline predates it) has
        // nothing to compare against beyond what's already above.
        const baselineContent = baseline?.files[match.path];
        if (match.engine !== 'diff-drift' || baselineContent === undefined) {
          return immediateFindings;
        }

        const cumulativeFindings = detectCumulativeDrift(match.path, baselineContent, head, immediateFindings);
        return [...immediateFindings, ...cumulativeFindings];
      })
    );

    findings = aggregateFindings(findingsBySource);
  }

  const octokit = await githubApp.getInstallationOctokit(installationId);
  await postFindings(octokit, { owner, repo, pullNumber, headSha, findings });
}
