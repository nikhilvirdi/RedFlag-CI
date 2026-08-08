import { Octokit } from '@octokit/rest';
import { logger } from './logger';

// v2 Phase A (architecture.md section 8): a small JSON snapshot committed to
// a dedicated branch, not a database -- "the last known-good state of each
// monitored file," not a full history. `files` stores each monitored
// diff-drift file's raw content exactly as it stood at the last merge,
// keyed by path. Deliberately the *same* shape the real file has on disk
// (not a separate abstracted record of "server names" / "permission
// entries" / "hooks"): storing the raw content means A.3's cumulative-drift
// check can feed a file's baseline entry straight into the existing
// diff-drift detectors as a synthetic "base" version, with no new
// comparison logic duplicated here.
export interface BaselineSnapshot {
  version: 1;
  updatedAt: string;
  files: Record<string, string>;
}

export const BASELINE_BRANCH = 'redflag-ci/baseline';
const BASELINE_FILE_PATH = 'baseline.json';

export interface BaselineRepoRequest {
  owner: string;
  repo: string;
  branch?: string;
}

export interface WriteBaselineRequest extends BaselineRepoRequest {
  snapshot: BaselineSnapshot;
}

// Pure: no Octokit, no I/O. Builds the snapshot that gets written after a
// merge from whatever monitored diff-drift file contents the caller already
// fetched (A.2's job -- gathering those is webhook-event-shaped work, kept
// out of this module per the task's "isolated from webhook logic" scope).
export function buildSnapshot(files: Record<string, string>): BaselineSnapshot {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    files: { ...files },
  };
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 404
  );
}

function isValidSnapshot(value: unknown): value is BaselineSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (obj.version !== 1 || typeof obj.updatedAt !== 'string') {
    return false;
  }
  if (typeof obj.files !== 'object' || obj.files === null || Array.isArray(obj.files)) {
    return false;
  }
  return Object.values(obj.files as Record<string, unknown>).every((v) => typeof v === 'string');
}

// Fail-open by design (architecture.md section 2, extended to baseline
// infrastructure by this task): a missing branch, a missing file, malformed
// JSON, or any other API failure all collapse to `null` here, not a thrown
// error. The caller's job is to fall back to today's stateless base/head
// comparison when this returns null, never to block a PR because the
// baseline isn't available.
export async function readBaseline(
  octokit: Octokit,
  request: BaselineRepoRequest
): Promise<BaselineSnapshot | null> {
  const { owner, repo, branch = BASELINE_BRANCH } = request;

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: BASELINE_FILE_PATH,
      ref: branch,
    });

    if (Array.isArray(data) || data.type !== 'file') {
      return null;
    }

    const raw = Buffer.from(data.content, 'base64').toString('utf-8');
    const parsed: unknown = JSON.parse(raw);
    return isValidSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// The baseline branch won't exist on a repo's first-ever merge past this
// feature's install; created off the default branch's current HEAD rather
// than as an orphan branch -- simpler (one extra API call, no raw git-object
// plumbing for a parentless commit) and the branch's ancestry doesn't matter
// for a file that gets wholly overwritten on every write.
async function ensureBaselineBranchExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<void> {
  try {
    await octokit.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
    return;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
  const { data: defaultBranchRef } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${repoInfo.default_branch}`,
  });

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: defaultBranchRef.object.sha,
  });
}

export async function writeBaseline(octokit: Octokit, request: WriteBaselineRequest): Promise<void> {
  const { owner, repo, snapshot, branch = BASELINE_BRANCH } = request;

  await ensureBaselineBranchExists(octokit, owner, repo, branch);

  let sha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: BASELINE_FILE_PATH,
      ref: branch,
    });
    if (!Array.isArray(data) && data.type === 'file') {
      sha = data.sha;
    }
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: BASELINE_FILE_PATH,
    branch,
    message: 'redflag-ci: update baseline snapshot',
    content: Buffer.from(JSON.stringify(snapshot, null, 2)).toString('base64'),
    sha,
  });
}

// Task A.4: A.2's merge-only update path is the only way the baseline is
// *meant* to change; an unprotected branch could be pushed to directly,
// bypassing it entirely (e.g. seeding a false "known good" state to hide
// drift, or wiping the baseline outright). This only ever logs a warning,
// never blocks anything -- fixing the branch's own protection settings is a
// repo-admin action outside RedFlag CI's own permission scope
// (architecture.md section 2's least-privilege principle), not something
// this tool can or should silently correct on someone's behalf.
//
// repos.getBranch (not the admin-only repos.getBranchProtection) is used
// deliberately: its response includes a plain `protected` boolean available
// to any caller with read access, so this check can't itself fail just
// because the installation lacks admin permissions on the repo.
export async function checkBaselineBranchProtection(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string = BASELINE_BRANCH
): Promise<void> {
  try {
    const { data } = await octokit.rest.repos.getBranch({ owner, repo, branch });
    if (!data.protected) {
      logger.warn('Baseline branch has no branch protection enabled', { owner, repo, branch });
    }
  } catch (error) {
    // Fail-open (architecture.md section 2): being unable to verify
    // protection status (branch not found, API error, etc.) is itself
    // worth logging distinctly, but never throws out of this check.
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Could not verify baseline branch protection status', { owner, repo, branch, message });
  }
}
