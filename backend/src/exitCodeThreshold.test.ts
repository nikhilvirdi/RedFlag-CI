import { Finding } from './types';
import { computeExitCode } from './exitCodeThreshold';

describe('Task B.3: computeExitCode', () => {
  // -------------------------------------------------------------------------
  // Fixtures
  // -------------------------------------------------------------------------

  const highFinding: Finding = {
    detectorId: 'diff-drift.hook-changed',
    severity: 'high',
    file: '.claude/settings.json',
    summary: 'High finding',
    detail: 'A high-severity finding.',
  };

  const warningFinding: Finding = {
    detectorId: 'diff-drift.new-mcp-server',
    severity: 'warning',
    file: '.mcp.json',
    summary: 'Warning finding',
    detail: 'A warning-severity finding.',
  };

  const infoFinding: Finding = {
    detectorId: 'rule-file.invisible-unicode',
    severity: 'info',
    file: 'CLAUDE.md',
    summary: 'Info finding',
    detail: 'An info-severity finding.',
  };

  // -------------------------------------------------------------------------
  // No threshold → always 0 (opt-in by construction)
  // -------------------------------------------------------------------------

  it('returns 0 when threshold is undefined, regardless of findings', () => {
    expect(computeExitCode([])).toBe(0);
    expect(computeExitCode([highFinding])).toBe(0);
    expect(computeExitCode([warningFinding])).toBe(0);
    expect(computeExitCode([infoFinding])).toBe(0);
    expect(computeExitCode([highFinding, warningFinding, infoFinding])).toBe(0);
  });

  it('returns 0 when threshold is explicitly undefined', () => {
    expect(computeExitCode([highFinding], undefined)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Empty findings list → always 0 regardless of threshold
  // -------------------------------------------------------------------------

  it('returns 0 for an empty findings list with threshold "high"', () => {
    expect(computeExitCode([], 'high')).toBe(0);
  });

  it('returns 0 for an empty findings list with threshold "warning"', () => {
    expect(computeExitCode([], 'warning')).toBe(0);
  });

  it('returns 0 for an empty findings list with threshold "info"', () => {
    expect(computeExitCode([], 'info')).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Threshold 'high' — only fires on high
  // -------------------------------------------------------------------------

  it('threshold "high": returns 0 when only warning findings are present', () => {
    expect(computeExitCode([warningFinding], 'high')).toBe(0);
  });

  it('threshold "high": returns 0 when only info findings are present', () => {
    expect(computeExitCode([infoFinding], 'high')).toBe(0);
  });

  it('threshold "high": returns 0 when only warning and info findings are present', () => {
    expect(computeExitCode([warningFinding, infoFinding], 'high')).toBe(0);
  });

  it('threshold "high": returns 1 when a high finding is present', () => {
    expect(computeExitCode([highFinding], 'high')).toBe(1);
  });

  it('threshold "high": returns 1 when high is among other findings', () => {
    expect(computeExitCode([warningFinding, highFinding, infoFinding], 'high')).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Threshold 'warning' — fires on high AND warning (meets-or-exceeds)
  // -------------------------------------------------------------------------

  it('threshold "warning": returns 0 when only info findings are present', () => {
    expect(computeExitCode([infoFinding], 'warning')).toBe(0);
  });

  it('threshold "warning": returns 1 when a warning finding is present', () => {
    expect(computeExitCode([warningFinding], 'warning')).toBe(1);
  });

  it('threshold "warning": returns 1 when only a high finding is present (high meets-or-exceeds warning)', () => {
    expect(computeExitCode([highFinding], 'warning')).toBe(1);
  });

  it('threshold "warning": returns 1 when both high and warning are present', () => {
    expect(computeExitCode([highFinding, warningFinding], 'warning')).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Threshold 'info' — lowest bar; any finding triggers it
  // -------------------------------------------------------------------------

  it('threshold "info": returns 1 when any info finding is present', () => {
    expect(computeExitCode([infoFinding], 'info')).toBe(1);
  });

  it('threshold "info": returns 1 when any warning finding is present', () => {
    expect(computeExitCode([warningFinding], 'info')).toBe(1);
  });

  it('threshold "info": returns 1 when any high finding is present', () => {
    expect(computeExitCode([highFinding], 'info')).toBe(1);
  });

  it('threshold "info": returns 1 with a mixed list', () => {
    expect(computeExitCode([highFinding, warningFinding, infoFinding], 'info')).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Return values are strictly 0 or 1 (number, not boolean)
  // -------------------------------------------------------------------------

  it('return value is the number 0, not false', () => {
    expect(computeExitCode([])).toBe(0);
    expect(typeof computeExitCode([])).toBe('number');
  });

  it('return value is the number 1, not true', () => {
    expect(computeExitCode([highFinding], 'high')).toBe(1);
    expect(typeof computeExitCode([highFinding], 'high')).toBe('number');
  });

  // -------------------------------------------------------------------------
  // Determinism
  // -------------------------------------------------------------------------

  it('is deterministic: same inputs always produce the same result', () => {
    const findings = [highFinding, warningFinding, infoFinding];
    expect(computeExitCode(findings, 'warning')).toBe(computeExitCode(findings, 'warning'));
  });
});
