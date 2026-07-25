import * as fs from 'fs';
import * as path from 'path';
import { detectNewMcpServer } from './newMcpServer';

describe('DD-1: detectNewMcpServer', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'dd1');

  it('produces exactly one finding when a new MCP server is added (fixture)', () => {
    const beforeContent = fs.readFileSync(
      path.join(fixturesDir, 'new-server', 'before.json'),
      'utf-8'
    );
    const afterContent = fs.readFileSync(
      path.join(fixturesDir, 'new-server', 'after.json'),
      'utf-8'
    );

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.new-mcp-server',
      severity: 'warning',
      file: '.mcp.json',
      summary: "New MCP server 'fetch' added",
      detail:
        "The head branch adds a new MCP server entry 'fetch' to .mcp.json. Adding new MCP servers widens the tool execution surface area available to AI agents.",
    });
  });

  it('produces zero findings when there is no change in MCP servers (fixture)', () => {
    const beforeContent = fs.readFileSync(
      path.join(fixturesDir, 'no-change', 'before.json'),
      'utf-8'
    );
    const afterContent = fs.readFileSync(
      path.join(fixturesDir, 'no-change', 'after.json'),
      'utf-8'
    );

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(0);
  });

  it('produces findings when a file is newly added in head branch (base is null)', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        server1: { command: 'node', args: ['server.js'] },
      },
    });

    const findings = detectNewMcpServer('.cursor/mcp.json', null, headContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("New MCP server 'server1' added");
  });

  it('produces zero findings when headContent is null (file deleted in head)', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { server1: {} },
    });

    const findings = detectNewMcpServer('.mcp.json', beforeContent, null);

    expect(findings).toHaveLength(0);
  });

  it('fails open (returns 0 findings) when headContent is malformed JSON', () => {
    const beforeContent = '{"mcpServers": {}}';
    const invalidHeadContent = '{ malformed json';

    const findings = detectNewMcpServer('.mcp.json', beforeContent, invalidHeadContent);

    expect(findings).toHaveLength(0);
  });

  it('fails open (returns 0 findings) when baseContent is malformed JSON', () => {
    const invalidBaseContent = '{ malformed json';
    const afterContent = '{"mcpServers": {"server1": {}}}';

    const findings = detectNewMcpServer('.mcp.json', invalidBaseContent, afterContent);

    expect(findings).toHaveLength(0);
  });

  it('fails open (returns 0 findings) when content is valid JSON primitive or array', () => {
    expect(detectNewMcpServer('.mcp.json', '{"mcpServers": {}}', '[1, 2, 3]')).toHaveLength(0);
    expect(detectNewMcpServer('.mcp.json', '{"mcpServers": {}}', '"hello"')).toHaveLength(0);
    expect(detectNewMcpServer('.mcp.json', '{"mcpServers": {}}', '123')).toHaveLength(0);
    expect(detectNewMcpServer('.mcp.json', '{"mcpServers": {}}', 'null')).toHaveLength(0);
    expect(detectNewMcpServer('.mcp.json', '{"mcpServers": {}}', '')).toHaveLength(0);
  });

  it('detects multiple new servers added simultaneously', () => {
    const beforeContent = JSON.stringify({ mcpServers: { s1: {} } });
    const afterContent = JSON.stringify({ mcpServers: { s1: {}, s2: {}, s3: {} } });

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(2);
    const summaries = findings.map((f) => f.summary);
    expect(summaries).toContain("New MCP server 's2' added");
    expect(summaries).toContain("New MCP server 's3' added");
  });

  it('supports "servers" top-level key as well as "mcpServers"', () => {
    const beforeContent = JSON.stringify({ servers: { s1: {} } });
    const afterContent = JSON.stringify({ servers: { s1: {}, s2: {} } });

    const findings = detectNewMcpServer('claude_desktop_config.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("New MCP server 's2' added");
  });
});
