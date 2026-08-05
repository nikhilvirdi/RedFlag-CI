import { Finding } from './types';
import { formatFindingsComment } from './formatFindingsComment';

describe('Task 5.2: formatFindingsComment', () => {
  const sampleFindings: Finding[] = [
    {
      detectorId: 'diff-drift.hook-changed',
      severity: 'high',
      file: '.claude/settings.json',
      summary: "New hook 'PostToolUse' added",
      detail:
        "The head branch adds a new hook 'PostToolUse' with command './scripts/notify.sh' to " +
        ".claude/settings.json. Injecting or altering hooks is the attack vector behind " +
        "CVE-2025-59536, which exploits Claude Code's hooks by executing unauthorized commands " +
        'in .claude/settings.json.',
    },
    {
      detectorId: 'rule-file.invisible-unicode',
      severity: 'high',
      file: 'CLAUDE.md',
      summary: 'Invisible Unicode character (U+200B) found',
      detail:
        'A zero-width space (U+200B) was found in CLAUDE.md at line 5, column 3. Invisible and ' +
        'bidirectional-control characters have no legitimate use in an instruction file and can ' +
        'be used to hide malicious instructions from human reviewers while an AI agent still ' +
        'reads and follows them.',
    },
    {
      detectorId: 'diff-drift.new-mcp-server',
      severity: 'warning',
      file: '.mcp.json',
      summary: "New MCP server 'example-server' added",
      detail:
        "The head branch adds a new MCP server entry named 'example-server' to .mcp.json that " +
        "was not present in the base branch. New tool servers should be reviewed before merge.",
    },
  ];

  it('matches the expected comment format for a multi-finding list (snapshot)', () => {
    expect(formatFindingsComment(sampleFindings)).toMatchSnapshot();
  });

  it('returns an empty string for an empty findings list', () => {
    expect(formatFindingsComment([])).toBe('');
  });

  it('uses singular "issue" for exactly one finding', () => {
    const result = formatFindingsComment([sampleFindings[0]]);

    expect(result).toContain('RedFlag CI found 1 issue:');
    expect(result).not.toContain('1 issues');
  });

  it('uses plural "issues" for more than one finding', () => {
    const result = formatFindingsComment(sampleFindings);

    expect(result).toContain(`RedFlag CI found ${sampleFindings.length} issues:`);
  });

  it('renders one bullet line per finding, in the order given (no re-sorting)', () => {
    const result = formatFindingsComment(sampleFindings);
    const bulletLines = result.split('\n').filter((line) => line.startsWith('- '));

    expect(bulletLines).toHaveLength(3);
    expect(bulletLines[0]).toContain("New hook 'PostToolUse' added");
    expect(bulletLines[1]).toContain('Invisible Unicode character (U+200B) found');
    expect(bulletLines[2]).toContain("New MCP server 'example-server' added");
  });

  it('includes severity, file, summary, and detail (with its CVE reference) for each finding', () => {
    const result = formatFindingsComment([sampleFindings[0]]);

    expect(result).toContain('**HIGH**');
    expect(result).toContain('`.claude/settings.json`');
    expect(result).toContain("New hook 'PostToolUse' added");
    expect(result).toContain('CVE-2025-59536');
  });
});
