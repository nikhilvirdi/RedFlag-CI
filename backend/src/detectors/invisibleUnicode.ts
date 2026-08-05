import { Finding } from '../types';

const CHARACTER_NAMES: Record<number, string> = {
  0x200b: 'zero-width space',
  0x200c: 'zero-width non-joiner',
  0x200d: 'zero-width joiner',
  0x202a: 'left-to-right embedding',
  0x202b: 'right-to-left embedding',
  0x202c: 'pop directional formatting',
  0x202d: 'left-to-right override',
  0x202e: 'right-to-left override',
  0x2066: 'left-to-right isolate',
  0x2067: 'right-to-left isolate',
  0x2068: 'first strong isolate',
  0x2069: 'pop directional isolate',
};

const INVISIBLE_CHAR_PATTERN = /[\u200B-\u200D\u202A-\u202E\u2066-\u2069]/g;

function locate(content: string, index: number): { line: number; column: number } {
  const before = content.slice(0, index);
  const lastNewline = before.lastIndexOf('\n');
  return { line: before.split('\n').length, column: index - lastNewline };
}

export function detectInvisibleUnicode(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  let match: RegExpExecArray | null;

  while ((match = INVISIBLE_CHAR_PATTERN.exec(content)) !== null) {
    const codePoint = match[0].codePointAt(0) as number;
    const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');
    const name = CHARACTER_NAMES[codePoint] ?? 'invisible/bidi-control character';
    const { line, column } = locate(content, match.index);

    findings.push({
      detectorId: 'rule-file.invisible-unicode',
      severity: 'high',
      file: filePath,
      summary: `Invisible Unicode character (U+${hex}) found`,
      detail: `A ${name} (U+${hex}) was found in ${filePath} at line ${line}, column ${column}. Invisible and bidirectional-control characters have no legitimate use in an instruction file and can be used to hide malicious instructions from human reviewers while an AI agent still reads and follows them.`,
    });
  }

  return findings;
}
