import { Finding } from './types';
import { detectNewMcpServer } from './detectors/newMcpServer';
import { detectSwappedMcpServer } from './detectors/swappedMcpServer';
import { detectWidenedPermissions } from './detectors/widenedPermissions';
import { detectHookChanged } from './detectors/hookChanged';
import { detectTransportTypeChange } from './detectors/transportTypeChange';

// Task A.3: the same base/head-comparing diff-drift detectors
// processPullRequestEvent.ts already runs against the PR's immediate base,
// run again with the stored baseline as "base" instead. Current-state
// detectors (unpinned dependency, obfuscated command, duplicate key,
// suspicious network target, path traversal, RF-1/RF-2-on-JSON-keys) are
// deliberately excluded: they only ever look at head content regardless of
// what "base" they're given, so re-running them here would just reproduce
// the exact same findings the immediate comparison already computed --
// nothing to gain, only duplicate work.
function runBaseHeadDetectors(filePath: string, base: string | null, head: string | null): Finding[] {
  return [
    ...detectNewMcpServer(filePath, base, head),
    ...detectSwappedMcpServer(filePath, base, head),
    ...detectWidenedPermissions(filePath, base, head),
    ...detectHookChanged(filePath, base, head),
    ...detectTransportTypeChange(filePath, base, head),
  ];
}

// Two findings are "the same" for dedup purposes if they share a detector,
// a file, and a summary -- summary already names the specific entry
// (server/permission/hook) a finding is about, so this is precise without
// needing to compare full detail text.
function findingKey(finding: Finding): string {
  return `${finding.detectorId}|${finding.file}|${finding.summary}`;
}

// Compares the current PR's head content against the stored baseline (the
// state as of the last merge -- which, since the baseline updates on every
// merge, already reflects every merge before it, not only the one
// immediately preceding this PR) and returns only the findings that
// surfaces beyond what comparing against the immediate base already found.
// This is what catches the adversarial-gradual-drift-two-prs pattern: two
// small, individually unremarkable widenings across two separate merged
// PRs, each invisible to a single-PR-scoped check, become visible once
// compared against a baseline that predates both -- but a PR whose own
// immediate-base comparison already reports everything the baseline
// comparison would (the common case: a normal PR with no accumulated prior
// drift) gets no duplicate findings out of this.
export function detectCumulativeDrift(
  filePath: string,
  baselineContent: string,
  headContent: string | null,
  alreadyReported: Finding[]
): Finding[] {
  const cumulative = runBaseHeadDetectors(filePath, baselineContent, headContent);
  const seen = new Set(alreadyReported.map(findingKey));
  return cumulative.filter((finding) => !seen.has(findingKey(finding)));
}
