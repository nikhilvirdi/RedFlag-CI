import { Finding } from './types';

// Severity ordering, from highest to lowest. The index in this array is the
// numeric rank: lower index = higher severity. Any future severity level added
// to Finding only needs to be inserted here in the right position.
export const SEVERITY_ORDER: ReadonlyArray<Finding['severity']> = ['high', 'warning', 'info'];

// Returns the numeric rank of a severity level (0 is highest severity).
export function severityRank(severity: Finding['severity']): number {
  return SEVERITY_ORDER.indexOf(severity);
}

// Sort comparator for ordering findings by severity (highest severity first).
export function compareSeverity(a: Finding['severity'], b: Finding['severity']): number {
  return severityRank(a) - severityRank(b);
}

// Returns true when `candidate` is at least as severe as `threshold` --
// i.e. its position in SEVERITY_ORDER is at or before threshold's position.
// A lower index means higher severity, so "meets or exceeds" is <=.
export function meetsOrExceeds(
  candidate: Finding['severity'],
  threshold: Finding['severity']
): boolean {
  return severityRank(candidate) <= severityRank(threshold);
}
