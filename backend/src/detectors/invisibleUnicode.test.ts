import * as fs from 'fs';
import * as path from 'path';
import { detectInvisibleUnicode } from './invisibleUnicode';

describe('RF-1: detectInvisibleUnicode', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'rf1');
  const filePath = 'CLAUDE.md';

  const readFixture = (name: string): string =>
    fs.readFileSync(path.join(fixturesDir, name, 'CLAUDE.md'), 'utf-8');

  it('fires a HIGH-severity finding when a zero-width space is present (fixture)', () => {
    const findings = detectInvisibleUnicode(filePath, readFixture('zero-width-space'));

    expect(findings).toHaveLength(1);
    expect(findings[0].detectorId).toBe('rule-file.invisible-unicode');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].file).toBe(filePath);
    expect(findings[0].summary).toBe('Invisible Unicode character (U+200B) found');
    expect(findings[0].detail).toContain('zero-width space');
  });

  it('fires a HIGH-severity finding when a bidirectional override character is present (fixture)', () => {
    const findings = detectInvisibleUnicode(filePath, readFixture('bidi-override'));

    expect(findings).toHaveLength(1);
    expect(findings[0].detectorId).toBe('rule-file.invisible-unicode');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].file).toBe(filePath);
    expect(findings[0].summary).toBe('Invisible Unicode character (U+202E) found');
    expect(findings[0].detail).toContain('right-to-left override');
  });

  it('does NOT fire on a clean file with no invisible characters (fixture)', () => {
    const findings = detectInvisibleUnicode(filePath, readFixture('clean'));

    expect(findings).toHaveLength(0);
  });

  it('detects a zero-width joiner and zero-width non-joiner', () => {
    expect(detectInvisibleUnicode(filePath, 'a‍b')).toHaveLength(1);
    expect(detectInvisibleUnicode(filePath, 'a‌b')).toHaveLength(1);
  });

  it('detects the full bidi embedding/override/isolate range', () => {
    for (const cp of [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]) {
      const char = String.fromCodePoint(cp);
      expect(detectInvisibleUnicode(filePath, `text ${char} text`)).toHaveLength(1);
    }
  });

  it('reports one finding per occurrence when multiple invisible characters are present', () => {
    const content = 'a​b​c‮d';

    const findings = detectInvisibleUnicode(filePath, content);

    expect(findings).toHaveLength(3);
    expect(findings.every((f) => f.severity === 'high')).toBe(true);
  });

  it('returns zero findings for an empty string', () => {
    expect(detectInvisibleUnicode(filePath, '')).toHaveLength(0);
  });

  it('does not leak regex state across repeated calls (stateful global regex)', () => {
    const withMatch = 'a​b';
    const clean = 'plain text';

    expect(detectInvisibleUnicode(filePath, withMatch)).toHaveLength(1);
    expect(detectInvisibleUnicode(filePath, clean)).toHaveLength(0);
    expect(detectInvisibleUnicode(filePath, withMatch)).toHaveLength(1);
  });
});
