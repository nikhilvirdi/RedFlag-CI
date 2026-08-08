import { Finding } from './types';

const SEVERITY_LABEL: Record<Finding['severity'], string> = {
  high: 'HIGH',
  warning: 'WARNING',
  info: 'INFO',
};

function formatFindingBullet(finding: Finding): string {
  return `- **${SEVERITY_LABEL[finding.severity]}** \`${finding.file}\`: ${finding.summary}. ${finding.detail}`;
}

// Returns '' for an empty findings list. architecture.md section 6: a comment
// only posts when there's at least one finding; Task 5.3's posting logic
// decides whether to post based on this return value.
export function formatFindingsComment(findings: Finding[]): string {
  if (findings.length === 0) {
    return '';
  }

  const noun = findings.length === 1 ? 'issue' : 'issues';
  const lines = findings.map(formatFindingBullet);

  return [`**RedFlag CI found ${findings.length} ${noun}:**`, '', ...lines].join('\n');
}

// Task A.6: renders as its own distinct section, not folded into the main
// list above -- these findings only show up by comparing against the
// stored baseline (Task A.3), not this PR's own base/head diff, so calling
// them out separately is the point: "this looks widened" alone doesn't tell
// a reviewer the change isn't even visible in their own PR's diff. Reuses
// the exact same bullet format as formatFindingsComment above.
export function formatCumulativeDriftSection(cumulativeFindings: Finding[]): string {
  if (cumulativeFindings.length === 0) {
    return '';
  }

  const noun = cumulativeFindings.length === 1 ? 'change' : 'changes';
  const lines = cumulativeFindings.map(formatFindingBullet);

  return [
    `**${cumulativeFindings.length} additional ${noun} found since the last known-good baseline** ` +
      "(accumulated drift from prior merges, not part of this PR's own diff):",
    '',
    ...lines,
  ].join('\n');
}
