import { GitHubApp, getChangedFiles } from './githubApp';
import { filterMonitoredFiles } from './monitoredFiles';
import { getFileVersions } from './fileVersions';
import { detectNewMcpServer } from './detectors/newMcpServer';
import { detectSwappedMcpServer } from './detectors/swappedMcpServer';
import { detectWidenedPermissions } from './detectors/widenedPermissions';
import { detectHookChanged } from './detectors/hookChanged';
import { detectUnpinnedMcpDependency } from './detectors/unpinnedMcpDependency';
import { detectObfuscatedCommand } from './detectors/obfuscatedCommand';
import { detectInvisibleUnicode } from './detectors/invisibleUnicode';
import { detectHomoglyphs } from './detectors/homoglyphs';
import { aggregateFindings } from './aggregateFindings';
import { postFindings } from './postFindings';
import { Finding } from './types';

const PROCESSED_ACTIONS = new Set(['opened', 'synchronize']);

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
  return [
    ...detectNewMcpServer(filePath, base, head),
    ...detectSwappedMcpServer(filePath, base, head),
    ...detectWidenedPermissions(filePath, base, head),
    ...detectHookChanged(filePath, base, head),
    ...detectUnpinnedMcpDependency(filePath, head),
    ...detectObfuscatedCommand(filePath, head),
  ];
}

function runRuleFileDetectors(filePath: string, head: string | null): Finding[] {
  if (head === null) {
    return [];
  }
  return [...detectInvisibleUnicode(filePath, head), ...detectHomoglyphs(filePath, head)];
}

export async function processPullRequestEvent(githubApp: GitHubApp, payload: unknown): Promise<void> {
  const event = parsePullRequestEvent(payload);
  if (!event) {
    return;
  }

  const { owner, repo, pullNumber, headSha, baseRef, headRef, installationId } = event;

  const changedFiles = await getChangedFiles(githubApp, { installationId, owner, repo, pullNumber });
  const { matches } = filterMonitoredFiles(changedFiles);

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

        return match.engine === 'diff-drift'
          ? runDiffDriftDetectors(match.path, base, head)
          : runRuleFileDetectors(match.path, head);
      })
    );

    findings = aggregateFindings(findingsBySource);
  }

  const octokit = await githubApp.getInstallationOctokit(installationId);
  await postFindings(octokit, { owner, repo, pullNumber, headSha, findings });
}
