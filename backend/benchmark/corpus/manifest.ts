export type Engine = 'diff-drift' | 'rule-file';
export type GroundTruth = 'positive' | 'negative';

export interface CorpusScenario {
  id: string;
  description: string;
  filePath: string;
  engine: Engine;
  detectorUnderTest: string;
  groundTruth: GroundTruth;
  note?: string;
}

// 18 synthetic PR scenarios: 8 true-positive cases (covering all six detectors,
// with an extra code-path variant each for DD-3 and DD-4), 4 genuinely benign
// changes to monitored files, 5 near-miss cases designed to stress-test false
// positives, and 1 known-gap case designed to stress-test a false negative.
// Composition is deliberately not skewed toward cases known to pass -- see
// RESULTS.md for the honest false-positive/false-negative writeups.
export const SCENARIOS: CorpusScenario[] = [
  {
    id: 'dd1-new-server',
    description: 'A brand-new MCP server entry is added alongside an untouched existing one.',
    filePath: '.mcp.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.new-mcp-server',
    groundTruth: 'positive',
  },
  {
    id: 'dd2-command-swap',
    description: "MCPoison pattern: an already-approved server's args are silently repointed.",
    filePath: '.mcp.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.swapped-mcp-server',
    groundTruth: 'positive',
  },
  {
    id: 'dd3-wildcard-added',
    description: 'A wildcard permission is introduced into the allow-list (high-severity path).',
    filePath: '.claude/settings.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.widened-permissions',
    groundTruth: 'positive',
  },
  {
    id: 'dd3-plain-allow-added',
    description: 'A non-wildcard permission is added to the allow-list (warning-severity path).',
    filePath: '.claude/settings.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.widened-permissions',
    groundTruth: 'positive',
  },
  {
    id: 'dd4-hook-added',
    description: 'A brand-new hook is added under an event that had no hooks before.',
    filePath: '.claude/settings.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.hook-changed',
    groundTruth: 'positive',
  },
  {
    id: 'dd4-hook-command-changed',
    description: "CVE-2025-59536 pattern: an existing hook's command is replaced with a malicious one.",
    filePath: '.claude/settings.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.hook-changed',
    groundTruth: 'positive',
  },
  {
    id: 'rf1-zero-width-space',
    description: 'A zero-width space is hidden inside an instruction-hijacking sentence in CLAUDE.md.',
    filePath: 'CLAUDE.md',
    engine: 'rule-file',
    detectorUnderTest: 'rule-file.invisible-unicode',
    groundTruth: 'positive',
  },
  {
    id: 'rf2-cyrillic-homoglyph',
    description: "A Cyrillic 'a' look-alike is substituted into a permission-widening sentence.",
    filePath: '.cursor/rules/security.md',
    engine: 'rule-file',
    detectorUnderTest: 'rule-file.homoglyph',
    groundTruth: 'positive',
  },
  {
    id: 'benign-mcp-reorder',
    description: 'Two existing MCP servers are reordered and an unrelated top-level field is added; no server fields change.',
    filePath: '.mcp.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.new-mcp-server',
    groundTruth: 'negative',
    note: 'Stresses whether DD-1/DD-2 are order-sensitive at the object level (they should not be; comparisons are set/key based).',
  },
  {
    id: 'benign-claude-md-doc-addition',
    description: 'A plain-English documentation section is added to CLAUDE.md, no special characters.',
    filePath: 'CLAUDE.md',
    engine: 'rule-file',
    detectorUnderTest: 'rule-file.invisible-unicode',
    groundTruth: 'negative',
  },
  {
    id: 'benign-permissions-narrowing',
    description: 'An allow entry is removed and a deny rule is added for the same action -- a pure narrowing.',
    filePath: '.claude/settings.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.widened-permissions',
    groundTruth: 'negative',
  },
  {
    id: 'benign-copilot-instructions-edit',
    description: 'A harmless style-preference sentence is added to copilot-instructions.md.',
    filePath: '.github/copilot-instructions.md',
    engine: 'rule-file',
    detectorUnderTest: 'rule-file.invisible-unicode',
    groundTruth: 'negative',
  },
  {
    id: 'near-miss-args-reorder',
    description: "An MCP server's two independent CLI flags are reordered; the positional package argument stays last and behavior is unchanged.",
    filePath: '.mcp.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.swapped-mcp-server',
    groundTruth: 'negative',
    note: 'DD-2 compares args via JSON.stringify, which is order-sensitive by design (see the code comment: reordering CAN change execution semantics for positional CLI args, so it is deliberately treated as drift). Included to test that documented tradeoff honestly rather than assume it away.',
  },
  {
    id: 'near-miss-hook-removed',
    description: 'An existing hook is deleted outright, with no other hooks changed.',
    filePath: '.claude/settings.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.hook-changed',
    groundTruth: 'negative',
    note: 'DD-4 is scoped to "added or changed" per architecture.md 5; a pure removal is out of its stated scope, so silence here is correct, not a miss.',
  },
  {
    id: 'near-miss-bom',
    description: 'A UTF-8 byte-order-mark (U+FEFF) is prepended to CLAUDE.md, a common artifact of certain editors saving the file, with no other changes.',
    filePath: 'CLAUDE.md',
    engine: 'rule-file',
    detectorUnderTest: 'rule-file.invisible-unicode',
    groundTruth: 'negative',
    note: 'Stresses whether RF-1 over-fires on invisible-adjacent characters outside its documented U+200B-200D/202A-202E/2066-2069 ranges.',
  },
  {
    id: 'near-miss-legit-cyrillic-text',
    description: 'A genuine Russian-language example sentence is added to CLAUDE.md as localization documentation -- not an attack.',
    filePath: 'CLAUDE.md',
    engine: 'rule-file',
    detectorUnderTest: 'rule-file.homoglyph',
    groundTruth: 'negative',
    note: 'RF-2 is a pure character-class check with no natural-language awareness (architecture.md 5), so it cannot distinguish a homoglyph substituted into Latin text from a legitimate sentence written entirely in Cyrillic.',
  },
  {
    id: 'near-miss-mcp-server-rename',
    description: 'An existing MCP server is renamed to a clearer key; command and args are byte-for-byte identical.',
    filePath: '.mcp.json',
    engine: 'diff-drift',
    detectorUnderTest: 'diff-drift.new-mcp-server',
    groundTruth: 'negative',
    note: 'DD-1 diffs by key name only, so it cannot tell a rename of a trusted entry apart from a genuinely new, unreviewed one.',
  },
  {
    id: 'known-gap-uncommon-homoglyph',
    description: "A homoglyph attack using Cyrillic U+0501 ('d' look-alike), a code point not in RF-2's confusable table.",
    filePath: '.cursor/rules/deploy.md',
    engine: 'rule-file',
    detectorUnderTest: 'rule-file.homoglyph',
    groundTruth: 'positive',
    note: "This is a real attack pattern. RF-2's table covers well-documented confusables, not the full Unicode confusables database, per architecture.md 2's accepted precision-over-recall tradeoff: RedFlag CI will miss cleverly obfuscated attacks outside its deterministic checks.",
  },
];
