import { Finding } from './types';

// Severity ordering, from highest to lowest. The index in this array is the
// numeric rank: lower index = higher severity. Used by meetsOrExceeds() to
// compare two severity values without scattering the ordering rule across
// multiple inline comparisons. Any future severity level added to Finding
// only needs to be inserted here in the right position; nothing else changes.
const SEVERITY_ORDER: ReadonlyArray<Finding['severity']> = ['high', 'warning', 'info'];

// Returns true when `candidate` is at least as severe as `threshold` --
// i.e. its position in SEVERITY_ORDER is at or before threshold's position.
// A lower index means higher severity, so "meets or exceeds" is <=.
function meetsOrExceeds(
  candidate: Finding['severity'],
  threshold: Finding['severity']
): boolean {
  return SEVERITY_ORDER.indexOf(candidate) <= SEVERITY_ORDER.indexOf(threshold);
}

// Pure function: given a findings list and an optional severity threshold,
// returns 1 if any finding meets or exceeds the threshold, 0 otherwise.
//
// BOUNDARY: this function exists exclusively as advisory output for a
// consumer's own CI step (e.g., a GitHub Actions job that reads RedFlag CI's
// JSON/SARIF export and decides whether to fail its own build). It must never
// be called from processPullRequestEvent.ts or postFindings.ts.
// RedFlag CI's own check run always stays success/neutral (architecture.md
// section 6 -- "RedFlag CI reports, it never fails the build"). Wiring this
// into the GitHub App would violate that design contract.
//
// If threshold is undefined (no threshold configured), always returns 0.
// This makes the mechanism fully opt-in by construction: a consumer that
// doesn't pass a threshold can never get an exit-code failure from this
// function, regardless of what findings are present.
export function computeExitCode(
  findings: Finding[],
  threshold?: Finding['severity']
): number {
  if (threshold === undefined) {
    return 0;
  }

  const exceeded = findings.some((finding) => meetsOrExceeds(finding.severity, threshold));
  return exceeded ? 1 : 0;
}
