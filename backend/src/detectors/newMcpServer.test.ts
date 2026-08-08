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

  it('merges "mcpServers" and "servers" instead of the first present short-circuiting the other (fixture)', () => {
    // Closes the judgment-dd1-both-schema-keys-present gap: an empty
    // "mcpServers" ({}) previously made "servers" invisible entirely via
    // `mcpServers ?? servers`, since `??` only falls through on
    // null/undefined, not on an empty-but-present object.
    const beforeContent = fs.readFileSync(
      path.join(fixturesDir, 'both-schema-keys-present', 'before.json'),
      'utf-8'
    );
    const afterContent = fs.readFileSync(
      path.join(fixturesDir, 'both-schema-keys-present', 'after.json'),
      'utf-8'
    );

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("New MCP server 'browser' added");
  });

  it('treats a server name present under both keys as one entry, not a duplicate or a crash', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { shared: { command: 'a' } },
      servers: { shared: { command: 'b' } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { shared: { command: 'a' }, newOne: {} },
      servers: { shared: { command: 'b' } },
    });

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("New MCP server 'newOne' added");
  });

  it('still reads "servers" when "mcpServers" is present but malformed (not an object)', () => {
    const beforeContent = JSON.stringify({ mcpServers: 'not-an-object', servers: { s1: {} } });
    const afterContent = JSON.stringify({
      mcpServers: 'not-an-object',
      servers: { s1: {}, s2: {} },
    });

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("New MCP server 's2' added");
  });

  it('produces zero findings when a server is renamed with byte-identical command/args (fixture)', () => {
    // Closes the near-miss-mcp-server-rename false positive: 'fs-server' ->
    // 'filesystem-server', same command and args. Correlated as a rename via
    // correlateRemovedAdded, per this task's documented decision to report
    // nothing rather than a distinct "renamed" finding.
    const beforeContent = fs.readFileSync(
      path.join(fixturesDir, 'server-renamed', 'before.json'),
      'utf-8'
    );
    const afterContent = fs.readFileSync(
      path.join(fixturesDir, 'server-renamed', 'after.json'),
      'utf-8'
    );

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(0);
  });

  it('still reports a new server when a rename-shaped pair differs in command', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { old: { command: 'npx', args: ['-y', 'pkg'] } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { renamed: { command: 'uvx', args: ['-y', 'pkg'] } },
    });

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("New MCP server 'renamed' added");
  });

  it('still reports a new server when a rename-shaped pair differs in args', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { old: { command: 'npx', args: ['-y', 'pkg'] } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { renamed: { command: 'npx', args: ['-y', 'pkg', '--extra'] } },
    });

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("New MCP server 'renamed' added");
  });

  it('still reports a new server when a rename-shaped pair differs in env', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { old: { command: 'npx', args: ['pkg'], env: { API_URL: 'https://a.example' } } },
    });
    const afterContent = JSON.stringify({
      mcpServers: {
        renamed: { command: 'npx', args: ['pkg'], env: { API_URL: 'https://evil.example' } },
      },
    });

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("New MCP server 'renamed' added");
  });

  it('correlates only one rename pair when multiple servers are removed and added, one genuinely new', () => {
    const beforeContent = JSON.stringify({
      mcpServers: {
        'old-fs': { command: 'npx', args: ['-y', 'server-filesystem'] },
        'old-git': { command: 'npx', args: ['-y', 'server-git'] },
      },
    });
    const afterContent = JSON.stringify({
      mcpServers: {
        filesystem: { command: 'npx', args: ['-y', 'server-filesystem'] },
        'brand-new': { command: 'node', args: ['index.js'] },
      },
    });

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    // 'old-fs' -> 'filesystem' correlates as a rename (silent); 'old-git' is
    // simply gone (DD-1 never reports removals); 'brand-new' has no
    // correlated removal, so it still reports.
    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("New MCP server 'brand-new' added");
  });

  it('Task 5.8: does NOT report a new server when the same key is expressed in a different Unicode normalization form (fixture)', () => {
    // before.json's key is NFD ("cafe" + combining acute accent); after.json's
    // is the same server under the NFC (precomposed) form of the same name.
    // Byte-different, same logical key -- must not read as remove+add.
    const beforeContent = fs.readFileSync(
      path.join(fixturesDir, 'nfc-nfd-same-server-key', 'before.json'),
      'utf-8'
    );
    const afterContent = fs.readFileSync(
      path.join(fixturesDir, 'nfc-nfd-same-server-key', 'after.json'),
      'utf-8'
    );

    const findings = detectNewMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(0);
  });
});
