import { Finding } from './types';
import { aggregateFindings } from './aggregateFindings';

describe('Task 5.1: aggregateFindings', () => {
  const makeFinding = (detectorId: string, severity: Finding['severity']): Finding => ({
    detectorId,
    severity,
    file: '.claude/settings.json',
    summary: `${detectorId} summary`,
    detail: `${detectorId} detail`,
  });

  it('combines findings from multiple detectors into a single list, sorted high, warning, info', () => {
    const dd1 = [makeFinding('diff-drift.new-mcp-server', 'warning')];
    const dd2 = [makeFinding('diff-drift.swapped-mcp-server', 'high')];
    const rf1 = [makeFinding('rule-file.invisible-unicode', 'high')];
    const rf2 = [makeFinding('rule-file.homoglyph', 'info')];

    const result = aggregateFindings([dd1, dd2, rf1, rf2]);

    expect(result).toHaveLength(4);
    expect(result.map((f) => f.severity)).toEqual(['high', 'high', 'warning', 'info']);
  });

  it('preserves stable secondary order (detector order, then in-detector order) for same-severity findings', () => {
    const dd1 = [makeFinding('dd1-a', 'high'), makeFinding('dd1-b', 'high')];
    const dd2 = [makeFinding('dd2-a', 'warning')];
    const dd3 = [makeFinding('dd3-a', 'high'), makeFinding('dd3-b', 'warning')];

    const result = aggregateFindings([dd1, dd2, dd3]);

    // All three "high" findings must appear before the two "warning" findings,
    // and within each severity tier, arrival order (source array order, then
    // index within that source) must be preserved exactly.
    expect(result.map((f) => f.detectorId)).toEqual(['dd1-a', 'dd1-b', 'dd3-a', 'dd2-a', 'dd3-b']);
  });

  it('returns an empty list when given no sources', () => {
    expect(aggregateFindings([])).toEqual([]);
  });

  it('returns an empty list when every source produced zero findings', () => {
    expect(aggregateFindings([[], [], []])).toEqual([]);
  });

  it('handles a single source with a single finding', () => {
    const finding = makeFinding('rule-file.homoglyph', 'high');

    expect(aggregateFindings([[finding]])).toEqual([finding]);
  });

  it('does not mutate the input arrays', () => {
    const dd1 = [makeFinding('dd1-a', 'warning'), makeFinding('dd1-b', 'high')];
    const originalOrder = dd1.map((f) => f.detectorId);

    aggregateFindings([dd1]);

    expect(dd1.map((f) => f.detectorId)).toEqual(originalOrder);
  });
});
