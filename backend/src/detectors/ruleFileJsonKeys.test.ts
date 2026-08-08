import * as fs from 'fs';
import * as path from 'path';
import { detectRuleFileChecksInJsonKeys } from './ruleFileJsonKeys';

describe('Task 5.3: RF-1/RF-2 extended to JSON config keys', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'rf-json-keys');

  const readFixture = (name: string, file: string): string =>
    fs.readFileSync(path.join(fixturesDir, name, file), 'utf-8');

  it('fires a homoglyph finding when an MCP server name contains a look-alike character (fixture)', () => {
    const findings = detectRuleFileChecksInJsonKeys(
      '.mcp.json',
      readFixture('homoglyph-mcp-server-name', 'mcp.json')
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].detectorId).toBe('rule-file.homoglyph');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].file).toBe('.mcp.json');
    expect(findings[0].summary).toBe('Cyrillic look-alike character (U+0430) found');
    expect(findings[0].detail).toContain("visually identical to Latin 'a'");
  });

  it('does NOT fire on a clean MCP server name using only standard Latin characters (fixture)', () => {
    const findings = detectRuleFileChecksInJsonKeys(
      '.mcp.json',
      readFixture('clean-mcp-server-name', 'mcp.json')
    );

    expect(findings).toHaveLength(0);
  });

  it('fires an invisible-Unicode finding when a permission entry contains a hidden character (fixture)', () => {
    const findings = detectRuleFileChecksInJsonKeys(
      '.claude/settings.json',
      readFixture('invisible-permission-entry', 'settings.json')
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].detectorId).toBe('rule-file.invisible-unicode');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].file).toBe('.claude/settings.json');
    expect(findings[0].summary).toBe('Invisible Unicode character (U+200B) found');
    expect(findings[0].detail).toContain('zero-width space');
  });

  it('does NOT fire on clean permission entries using only standard characters (fixture)', () => {
    const findings = detectRuleFileChecksInJsonKeys(
      '.claude/settings.json',
      readFixture('clean-permission-entry', 'settings.json')
    );

    expect(findings).toHaveLength(0);
  });

  it('returns zero findings when headContent is null (file deleted in head)', () => {
    expect(detectRuleFileChecksInJsonKeys('.mcp.json', null)).toHaveLength(0);
  });

  it('returns zero findings for malformed JSON', () => {
    expect(detectRuleFileChecksInJsonKeys('.mcp.json', '{not valid json')).toHaveLength(0);
  });

  it('returns zero findings for a file with neither mcpServers/servers nor permissions', () => {
    expect(detectRuleFileChecksInJsonKeys('.claude/settings.json', JSON.stringify({ hooks: {} }))).toHaveLength(
      0
    );
  });

  it('scans both "servers" and "mcpServers" keys for homoglyphs', () => {
    const content = JSON.stringify({
      servers: { 'slаck': { command: 'npx' } },
    });

    const findings = detectRuleFileChecksInJsonKeys('.cursor/mcp.json', content);

    expect(findings).toHaveLength(1);
    expect(findings[0].detectorId).toBe('rule-file.homoglyph');
  });

  it('scans deny-list entries, not just allow-list entries', () => {
    const content = JSON.stringify({
      permissions: { allow: [], deny: ['Bash(rm -rf /)​'] },
    });

    const findings = detectRuleFileChecksInJsonKeys('.claude/settings.json', content);

    expect(findings).toHaveLength(1);
    expect(findings[0].detectorId).toBe('rule-file.invisible-unicode');
  });
});
