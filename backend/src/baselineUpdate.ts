import { GitHubApp } from './githubApp';
import { getFileAtRef } from './fileVersions';
import { DIFF_DRIFT_FILES } from './monitoredFiles';
import { buildSnapshot, writeBaseline, checkBaselineBranchProtection } from './baseline';

export interface MergeEvent {
  owner: string;
  repo: string;
  mergeCommitSha: string;
  installationId: number;
}

// Task A.2: fetches every diff-drift monitored path at the merge commit --
// not just whichever ones this particular PR touched -- so the baseline
// always reflects the repo's full current state. A PR that only changes
// .mcp.json must not cause .claude/settings.json's previously-known
// permissions/hooks to silently drop out of the baseline. Any path that
// doesn't exist in this repo (getFileAtRef returns null, a 404) is simply
// absent from the snapshot, same as buildSnapshot's own empty-map default.
export async function updateBaselineOnMerge(githubApp: GitHubApp, event: MergeEvent): Promise<void> {
  const { owner, repo, mergeCommitSha, installationId } = event;

  const contents = await Promise.all(
    DIFF_DRIFT_FILES.map((path) =>
      getFileAtRef(githubApp, { installationId, owner, repo, path, ref: mergeCommitSha })
    )
  );

  const files: Record<string, string> = {};
  DIFF_DRIFT_FILES.forEach((path, i) => {
    const content = contents[i];
    if (content !== null) {
      files[path] = content;
    }
  });

  const snapshot = buildSnapshot(files);
  const octokit = await githubApp.getInstallationOctokit(installationId);
  await writeBaseline(octokit, { owner, repo, snapshot });

  // Task A.4: checked here, right after the branch we just depended on --
  // not on every webhook event, since protection status rarely changes and
  // this project has no periodic/background job infrastructure to run it
  // separately (architecture.md section 7: stateless, no queue). Never
  // allowed to affect whether the write above succeeded; this is purely
  // observability on top of it.
  await checkBaselineBranchProtection(octokit, owner, repo);
}
