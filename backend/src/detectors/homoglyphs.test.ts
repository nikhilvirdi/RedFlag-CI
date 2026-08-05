import * as fs from 'fs';
import * as path from 'path';
import { detectHomoglyphs } from './homoglyphs';

describe('RF-2: detectHomoglyphs', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'rf2');
  const filePath = 'CLAUDE.md';

  const readFixture = (name: string): string =>
    fs.readFileSync(path.join(fixturesDir, name, 'CLAUDE.md'), 'utf-8');

  it('fires a HIGH-severity finding when a Cyrillic look-alike character is present (fixture)', () => {
    const findings = detectHomoglyphs(filePath, readFixture('cyrillic-lookalike'));

    expect(findings).toHaveLength(1);
    expect(findings[0].detectorId).toBe('rule-file.homoglyph');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].file).toBe(filePath);
    expect(findings[0].summary).toBe('Cyrillic look-alike character (U+0430) found');
    expect(findings[0].detail).toContain("visually identical to Latin 'a'");
  });

  it('does NOT fire on a clean file using only standard Latin characters (fixture)', () => {
    const findings = detectHomoglyphs(filePath, readFixture('clean'));

    expect(findings).toHaveLength(0);
  });

  it('detects Cyrillic uppercase look-alikes', () => {
    for (const cp of [0x0410, 0x0412, 0x0415, 0x041a, 0x041c, 0x041d, 0x041e, 0x0420, 0x0421, 0x0422, 0x0423, 0x0425]) {
      const char = String.fromCodePoint(cp);
      const findings = detectHomoglyphs(filePath, `text ${char} text`);
      expect(findings).toHaveLength(1);
      expect(findings[0].summary).toContain('Cyrillic look-alike character');
    }
  });

  it('detects Cyrillic lowercase look-alikes beyond the "a" example', () => {
    for (const cp of [0x0435, 0x043e, 0x0440, 0x0441, 0x0443, 0x0445, 0x0455, 0x0456, 0x0458, 0x04bb]) {
      const char = String.fromCodePoint(cp);
      expect(detectHomoglyphs(filePath, `text ${char} text`)).toHaveLength(1);
    }
  });

  it('detects the Greek omicron look-alike called out in the spec', () => {
    const greekOmicron = String.fromCodePoint(0x03bf);

    const findings = detectHomoglyphs(filePath, `text ${greekOmicron} text`);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe('Greek look-alike character (U+03BF) found');
    expect(findings[0].detail).toContain("visually identical to Latin 'o'");
  });

  it('detects Greek uppercase look-alikes', () => {
    for (const cp of [0x0391, 0x0392, 0x0395, 0x0396, 0x0397, 0x0399, 0x039a, 0x039c, 0x039d, 0x039f, 0x03a1, 0x03a4, 0x03a5, 0x03a7]) {
      const char = String.fromCodePoint(cp);
      expect(detectHomoglyphs(filePath, `text ${char} text`)).toHaveLength(1);
    }
  });

  it('reports one finding per occurrence when multiple homoglyphs are present', () => {
    const cyrillicA = String.fromCodePoint(0x0430);
    const cyrillicE = String.fromCodePoint(0x0435);
    const greekOmicron = String.fromCodePoint(0x03bf);
    const content = `${cyrillicA}b${cyrillicE}c${greekOmicron}`;

    const findings = detectHomoglyphs(filePath, content);

    expect(findings).toHaveLength(3);
    expect(findings.every((f) => f.severity === 'high')).toBe(true);
  });

  it('does not flag ordinary Latin letters that happen to look like the homoglyph targets', () => {
    expect(detectHomoglyphs(filePath, 'apple sauce over rice')).toHaveLength(0);
  });

  it('returns zero findings for an empty string', () => {
    expect(detectHomoglyphs(filePath, '')).toHaveLength(0);
  });

  it('does not leak regex state across repeated calls (stateful global regex)', () => {
    const cyrillicA = String.fromCodePoint(0x0430);
    const withMatch = `a${cyrillicA}b`;
    const clean = 'plain text';

    expect(detectHomoglyphs(filePath, withMatch)).toHaveLength(1);
    expect(detectHomoglyphs(filePath, clean)).toHaveLength(0);
    expect(detectHomoglyphs(filePath, withMatch)).toHaveLength(1);
  });
});
