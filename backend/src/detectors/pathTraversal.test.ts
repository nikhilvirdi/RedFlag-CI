import * as fs from 'fs';
import * as path from 'path';
import { detectPathTraversal } from './pathTraversal';

describe('Task 5.6: detectPathTraversal', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'path-traversal');
  const filePath = '.mcp.json';

  const readFixture = (name: string): string =>
    fs.readFileSync(path.join(fixturesDir, name, '.mcp.json'), 'utf-8');

  it('fires a WARNING-severity finding for path traversal in args (fixture)', () => {
    const findings = detectPathTraversal(filePath, readFixture('args-traversal'));

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.path-traversal',
      severity: 'warning',
      file: filePath,
      summary: "MCP server 'file-reader' uses path traversal sequence in '../../etc/passwd'",
      detail:
        "The MCP server 'file-reader' in .mcp.json configures path traversal sequence " +
        "'../../etc/passwd'. Navigating outside expected directory boundaries using relative " +
        "path sequences ('../' or '..\\') can expose sensitive system files or escape directory sandboxing.",
    });
  });

  it('fires a WARNING-severity finding for path traversal in env (fixture)', () => {
    const findings = detectPathTraversal(filePath, readFixture('env-traversal'));

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.path-traversal',
      severity: 'warning',
      file: filePath,
      summary: "MCP server 'file-reader' uses path traversal sequence in '../secrets/key.pem'",
      detail:
        "The MCP server 'file-reader' in .mcp.json configures path traversal sequence " +
        "'../secrets/key.pem'. Navigating outside expected directory boundaries using relative " +
        "path sequences ('../' or '..\\') can expose sensitive system files or escape directory sandboxing.",
    });
  });

  it('produces zero findings for a benign relative path (fixture)', () => {
    const findings = detectPathTraversal(filePath, readFixture('benign'));

    expect(findings).toHaveLength(0);
  });

  it('is a current-state check: fires on head content alone with no base argument', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        server: { command: 'node', args: ['../config.json'] },
      },
    });

    const findings = detectPathTraversal('.mcp.json', headContent);

    expect(findings).toHaveLength(1);
  });

  it('detects Windows-style path traversal (..\\) in args or env', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        winServer: { command: 'node', env: { PATH: '..\\Windows\\System32\\config' } },
      },
    });

    const findings = detectPathTraversal('.mcp.json', headContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe(
      "MCP server 'winServer' uses path traversal sequence in '..\\Windows\\System32\\config'"
    );
  });

  it('does not fire on double-dots without path separators (e.g. revspecs main..head or ranges 1..10)', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        gitTool: { command: 'git', args: ['diff', 'main..feature'] },
        rangeTool: { command: 'node', args: ['--range=1..100'] },
      },
    });

    expect(detectPathTraversal('.mcp.json', headContent)).toHaveLength(0);
  });

  it('detects multiple path traversal sequences across different servers', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        a: { command: 'node', args: ['../a.json'] },
        b: { command: 'node', args: ['./b.json'] },
        c: { command: 'node', env: { FILE: '../../c.json' } },
      },
    });

    const findings = detectPathTraversal('.mcp.json', headContent);

    expect(findings).toHaveLength(2);
    const summaries = findings.map((f) => f.summary);
    expect(summaries).toContain("MCP server 'a' uses path traversal sequence in '../a.json'");
    expect(summaries).toContain("MCP server 'c' uses path traversal sequence in '../../c.json'");
  });

  it('produces zero findings when headContent is null (file deleted in head)', () => {
    expect(detectPathTraversal('.mcp.json', null)).toHaveLength(0);
  });

  it('fails open (returns 0 findings) when headContent is malformed JSON', () => {
    expect(detectPathTraversal('.mcp.json', '{ invalid json')).toHaveLength(0);
  });

  it('fails open (returns 0 findings) when content is valid JSON primitive or array', () => {
    expect(detectPathTraversal('.mcp.json', '[1, 2, 3]')).toHaveLength(0);
    expect(detectPathTraversal('.mcp.json', '"hello"')).toHaveLength(0);
    expect(detectPathTraversal('.mcp.json', '123')).toHaveLength(0);
    expect(detectPathTraversal('.mcp.json', 'null')).toHaveLength(0);
    expect(detectPathTraversal('.mcp.json', '')).toHaveLength(0);
  });

  it('supports "servers" top-level key as well as "mcpServers"', () => {
    const headContent = JSON.stringify({
      servers: {
        api: { command: 'node', args: ['../secret/path'] },
      },
    });

    const findings = detectPathTraversal('claude_desktop_config.json', headContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe('claude_desktop_config.json');
  });

  // Stress-test finding (backend/STRESS_TEST_FINDINGS.md, INT-A1): documents
  // a real, currently-open gap rather than fixing it -- PATH_TRAVERSAL_REGEX
  // is ASCII-only ("../" or "..\\"), and never has been. A fullwidth solidus
  // (U+FF0F, "／") renders as a visually near-identical slash but is a
  // completely different code point, so "..／etc／passwd" walks the same
  // directories a reviewer would read as "../etc/passwd" while matching
  // neither of PATH_TRAVERSAL_REGEX's two literal separators. This is the
  // same class of gap ADR 0001 already accepts for RF-2's confusables table
  // (a fixed, non-exhaustive character set), just applied to DD-6 instead of
  // RF-2 -- not something this test fixes, only tracks.
  it('known-gap: does NOT detect a fullwidth solidus (U+FF0F) standing in for the ASCII path separator', () => {
    const headContent = JSON.stringify({
      mcpServers: { fs: { command: 'node', args: ['..／etc／passwd'] } },
    });

    expect(detectPathTraversal('.mcp.json', headContent)).toHaveLength(0);

    // Control: the byte-identical-looking ASCII version is caught normally,
    // proving this is a character-class gap, not a broken fixture.
    const asciiEquivalent = JSON.stringify({
      mcpServers: { fs: { command: 'node', args: ['../etc/passwd'] } },
    });
    expect(detectPathTraversal('.mcp.json', asciiEquivalent)).toHaveLength(1);
  });
});
