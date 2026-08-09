import { Finding } from './types';

import { compareSeverity } from './severityOrder';

// Input is one Finding[] per detector run. Array.prototype.sort is a stable
// sort (spec-guaranteed since ES2019), so findings that tie on severity keep
// the relative order they arrived in: detector order, then index within
// that detector's own list.
export function aggregateFindings(findingsBySource: Finding[][]): Finding[] {
  return findingsBySource
    .flat()
    .sort((a, b) => compareSeverity(a.severity, b.severity));
}
