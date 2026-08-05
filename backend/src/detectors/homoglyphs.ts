import { Finding } from '../types';

interface HomoglyphInfo {
  latin: string;
  script: 'Cyrillic' | 'Greek';
}

// Well-documented Cyrillic/Greek letters that render pixel-identical to a
// Latin letter in most UI fonts (the classic IDN-homograph confusable set).
const HOMOGLYPHS: Record<number, HomoglyphInfo> = {
  // Cyrillic lowercase
  0x0430: { latin: 'a', script: 'Cyrillic' },
  0x0435: { latin: 'e', script: 'Cyrillic' },
  0x043e: { latin: 'o', script: 'Cyrillic' },
  0x0440: { latin: 'p', script: 'Cyrillic' },
  0x0441: { latin: 'c', script: 'Cyrillic' },
  0x0443: { latin: 'y', script: 'Cyrillic' },
  0x0445: { latin: 'x', script: 'Cyrillic' },
  0x0455: { latin: 's', script: 'Cyrillic' },
  0x0456: { latin: 'i', script: 'Cyrillic' },
  0x0458: { latin: 'j', script: 'Cyrillic' },
  0x04bb: { latin: 'h', script: 'Cyrillic' },
  // Cyrillic uppercase
  0x0410: { latin: 'A', script: 'Cyrillic' },
  0x0412: { latin: 'B', script: 'Cyrillic' },
  0x0415: { latin: 'E', script: 'Cyrillic' },
  0x041a: { latin: 'K', script: 'Cyrillic' },
  0x041c: { latin: 'M', script: 'Cyrillic' },
  0x041d: { latin: 'H', script: 'Cyrillic' },
  0x041e: { latin: 'O', script: 'Cyrillic' },
  0x0420: { latin: 'P', script: 'Cyrillic' },
  0x0421: { latin: 'C', script: 'Cyrillic' },
  0x0422: { latin: 'T', script: 'Cyrillic' },
  0x0423: { latin: 'Y', script: 'Cyrillic' },
  0x0425: { latin: 'X', script: 'Cyrillic' },
  // Greek uppercase
  0x0391: { latin: 'A', script: 'Greek' },
  0x0392: { latin: 'B', script: 'Greek' },
  0x0395: { latin: 'E', script: 'Greek' },
  0x0396: { latin: 'Z', script: 'Greek' },
  0x0397: { latin: 'H', script: 'Greek' },
  0x0399: { latin: 'I', script: 'Greek' },
  0x039a: { latin: 'K', script: 'Greek' },
  0x039c: { latin: 'M', script: 'Greek' },
  0x039d: { latin: 'N', script: 'Greek' },
  0x039f: { latin: 'O', script: 'Greek' },
  0x03a1: { latin: 'P', script: 'Greek' },
  0x03a4: { latin: 'T', script: 'Greek' },
  0x03a5: { latin: 'Y', script: 'Greek' },
  0x03a7: { latin: 'X', script: 'Greek' },
  // Greek lowercase
  0x03bf: { latin: 'o', script: 'Greek' },
};

const HOMOGLYPH_PATTERN = new RegExp(
  `[${Object.keys(HOMOGLYPHS)
    .map((cp) => String.fromCodePoint(Number(cp)))
    .join('')}]`,
  'g'
);

function locate(content: string, index: number): { line: number; column: number } {
  const before = content.slice(0, index);
  const lastNewline = before.lastIndexOf('\n');
  return { line: before.split('\n').length, column: index - lastNewline };
}

export function detectHomoglyphs(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  let match: RegExpExecArray | null;

  while ((match = HOMOGLYPH_PATTERN.exec(content)) !== null) {
    const codePoint = match[0].codePointAt(0) as number;
    const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');
    const info = HOMOGLYPHS[codePoint];
    const { line, column } = locate(content, match.index);

    findings.push({
      detectorId: 'rule-file.homoglyph',
      severity: 'high',
      file: filePath,
      summary: `${info.script} look-alike character (U+${hex}) found`,
      detail: `A ${info.script} character (U+${hex}) visually identical to Latin '${info.latin}' was found in ${filePath} at line ${line}, column ${column}. Homoglyphs can be used to disguise malicious instructions as ordinary text so a human reviewer skims past them while an AI agent still reads and follows them.`,
    });
  }

  return findings;
}
