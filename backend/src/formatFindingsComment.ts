import { Finding } from './types';

const SEVERITY_LABEL: Record<Finding['severity'], string> = {
  high: 'HIGH',
  warning: 'WARNING',
  info: 'INFO',
};

// Returns '' for an empty findings list. architecture.md section 6: a comment
// only posts when there's at least one finding; Task 5.3's posting logic
// decides whether to post based on this return value.
export function formatFindingsComment(findings: Finding[]): string {
  if (findings.length === 0) {
    return '';
  }

  const noun = findings.length === 1 ? 'issue' : 'issues';
  const lines = findings.map(
    (finding) =>
      `- **${SEVERITY_LABEL[finding.severity]}** \`${finding.file}\`: ${finding.summary}. ${finding.detail}`
  );

  return [`**RedFlag CI found ${findings.length} ${noun}:**`, '', ...lines].join('\n');
}
