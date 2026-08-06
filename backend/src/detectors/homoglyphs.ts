import { Finding } from '../types';

interface HomoglyphInfo {
  latin: string;
  script: 'Cyrillic' | 'Greek' | 'Fullwidth Latin' | 'Mathematical Bold' | 'Armenian' | 'Cherokee';
}

// Well-documented look-alike letters that render pixel-identical (or close
// enough to fool a skim-reader) to a Latin letter in most UI fonts -- the
// classic IDN-homograph confusable set, extended past Cyrillic/Greek to
// cover other scripts and blocks with the same property.
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
  // Fullwidth Latin (Halfwidth and Fullwidth Forms block) -- the fullwidth
  // equivalent of every Latin letter already covered above via another script.
  0xff41: { latin: 'a', script: 'Fullwidth Latin' },
  0xff45: { latin: 'e', script: 'Fullwidth Latin' },
  0xff4f: { latin: 'o', script: 'Fullwidth Latin' },
  0xff50: { latin: 'p', script: 'Fullwidth Latin' },
  0xff43: { latin: 'c', script: 'Fullwidth Latin' },
  0xff59: { latin: 'y', script: 'Fullwidth Latin' },
  0xff58: { latin: 'x', script: 'Fullwidth Latin' },
  0xff53: { latin: 's', script: 'Fullwidth Latin' },
  0xff49: { latin: 'i', script: 'Fullwidth Latin' },
  0xff4a: { latin: 'j', script: 'Fullwidth Latin' },
  0xff48: { latin: 'h', script: 'Fullwidth Latin' },
  0xff21: { latin: 'A', script: 'Fullwidth Latin' },
  0xff22: { latin: 'B', script: 'Fullwidth Latin' },
  0xff25: { latin: 'E', script: 'Fullwidth Latin' },
  0xff2b: { latin: 'K', script: 'Fullwidth Latin' },
  0xff2d: { latin: 'M', script: 'Fullwidth Latin' },
  0xff28: { latin: 'H', script: 'Fullwidth Latin' },
  0xff2f: { latin: 'O', script: 'Fullwidth Latin' },
  0xff30: { latin: 'P', script: 'Fullwidth Latin' },
  0xff23: { latin: 'C', script: 'Fullwidth Latin' },
  0xff34: { latin: 'T', script: 'Fullwidth Latin' },
  0xff39: { latin: 'Y', script: 'Fullwidth Latin' },
  0xff38: { latin: 'X', script: 'Fullwidth Latin' },
  0xff3a: { latin: 'Z', script: 'Fullwidth Latin' },
  0xff2e: { latin: 'N', script: 'Fullwidth Latin' },
  0xff29: { latin: 'I', script: 'Fullwidth Latin' },
  // Mathematical Bold (Mathematical Alphanumeric Symbols block, U+1D400
  // range) -- astral-plane code points, every letter A-Z/a-z in this one
  // representative style. Requires the regex's "u" flag below to match
  // correctly as single code points instead of two lone surrogate halves.
  0x1d400: { latin: 'A', script: 'Mathematical Bold' },
  0x1d401: { latin: 'B', script: 'Mathematical Bold' },
  0x1d402: { latin: 'C', script: 'Mathematical Bold' },
  0x1d403: { latin: 'D', script: 'Mathematical Bold' },
  0x1d404: { latin: 'E', script: 'Mathematical Bold' },
  0x1d405: { latin: 'F', script: 'Mathematical Bold' },
  0x1d406: { latin: 'G', script: 'Mathematical Bold' },
  0x1d407: { latin: 'H', script: 'Mathematical Bold' },
  0x1d408: { latin: 'I', script: 'Mathematical Bold' },
  0x1d409: { latin: 'J', script: 'Mathematical Bold' },
  0x1d40a: { latin: 'K', script: 'Mathematical Bold' },
  0x1d40b: { latin: 'L', script: 'Mathematical Bold' },
  0x1d40c: { latin: 'M', script: 'Mathematical Bold' },
  0x1d40d: { latin: 'N', script: 'Mathematical Bold' },
  0x1d40e: { latin: 'O', script: 'Mathematical Bold' },
  0x1d40f: { latin: 'P', script: 'Mathematical Bold' },
  0x1d410: { latin: 'Q', script: 'Mathematical Bold' },
  0x1d411: { latin: 'R', script: 'Mathematical Bold' },
  0x1d412: { latin: 'S', script: 'Mathematical Bold' },
  0x1d413: { latin: 'T', script: 'Mathematical Bold' },
  0x1d414: { latin: 'U', script: 'Mathematical Bold' },
  0x1d415: { latin: 'V', script: 'Mathematical Bold' },
  0x1d416: { latin: 'W', script: 'Mathematical Bold' },
  0x1d417: { latin: 'X', script: 'Mathematical Bold' },
  0x1d418: { latin: 'Y', script: 'Mathematical Bold' },
  0x1d419: { latin: 'Z', script: 'Mathematical Bold' },
  0x1d41a: { latin: 'a', script: 'Mathematical Bold' },
  0x1d41b: { latin: 'b', script: 'Mathematical Bold' },
  0x1d41c: { latin: 'c', script: 'Mathematical Bold' },
  0x1d41d: { latin: 'd', script: 'Mathematical Bold' },
  0x1d41e: { latin: 'e', script: 'Mathematical Bold' },
  0x1d41f: { latin: 'f', script: 'Mathematical Bold' },
  0x1d420: { latin: 'g', script: 'Mathematical Bold' },
  0x1d421: { latin: 'h', script: 'Mathematical Bold' },
  0x1d422: { latin: 'i', script: 'Mathematical Bold' },
  0x1d423: { latin: 'j', script: 'Mathematical Bold' },
  0x1d424: { latin: 'k', script: 'Mathematical Bold' },
  0x1d425: { latin: 'l', script: 'Mathematical Bold' },
  0x1d426: { latin: 'm', script: 'Mathematical Bold' },
  0x1d427: { latin: 'n', script: 'Mathematical Bold' },
  0x1d428: { latin: 'o', script: 'Mathematical Bold' },
  0x1d429: { latin: 'p', script: 'Mathematical Bold' },
  0x1d42a: { latin: 'q', script: 'Mathematical Bold' },
  0x1d42b: { latin: 'r', script: 'Mathematical Bold' },
  0x1d42c: { latin: 's', script: 'Mathematical Bold' },
  0x1d42d: { latin: 't', script: 'Mathematical Bold' },
  0x1d42e: { latin: 'u', script: 'Mathematical Bold' },
  0x1d42f: { latin: 'v', script: 'Mathematical Bold' },
  0x1d430: { latin: 'w', script: 'Mathematical Bold' },
  0x1d431: { latin: 'x', script: 'Mathematical Bold' },
  0x1d432: { latin: 'y', script: 'Mathematical Bold' },
  0x1d433: { latin: 'z', script: 'Mathematical Bold' },
  // Armenian letters with a well-documented visual resemblance to a Latin one.
  0x0585: { latin: 'o', script: 'Armenian' },
  0x0570: { latin: 'h', script: 'Armenian' },
  // Cherokee syllabary characters with a well-documented visual resemblance
  // to a Latin one (Sequoyah's script borrowed several shapes directly from
  // a Latin-alphabet spelling book, though the sound values differ).
  0x13a0: { latin: 'D', script: 'Cherokee' },
  0x13a1: { latin: 'R', script: 'Cherokee' },
  0x13da: { latin: 'o', script: 'Cherokee' },
};

// The "u" flag is required once the table contains astral-plane code points
// (the Mathematical Bold entries, all above U+FFFF): without it, a character
// class built from a surrogate-pair string matches each surrogate half as an
// independent BMP character instead of the intended single code point, which
// would both mis-fire on unrelated astral characters sharing that surrogate
// and crash the lookup below (HOMOGLYPHS has no entry for a lone surrogate).
// It has no effect on the existing BMP-only entries' matching behavior.
const HOMOGLYPH_PATTERN = new RegExp(
  `[${Object.keys(HOMOGLYPHS)
    .map((cp) => String.fromCodePoint(Number(cp)))
    .join('')}]`,
  'gu'
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
