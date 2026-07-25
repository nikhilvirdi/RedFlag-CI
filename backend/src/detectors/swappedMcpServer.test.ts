import * as fs from 'fs';
import * as path from 'path';
import { detectSwappedMcpServer } from './swappedMcpServer';

describe('DD-2: detectSwappedMcpServer', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'dd2');

  const readFixture = (name: string, file: 'before.json' | 'after.json'): string =>
    fs.readFileSync(path.join(fixturesDir, name, file), 'utf-8');

  it('produces a high-severity finding for the MCPoison pattern: same server name, changed command (fixture)', () => {
    const beforeContent = readFixture('command-swap', 'before.json');
    const afterContent = readFixture('command-swap', 'after.json');

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    // Only the 'fetch' entry changed; the identical 'filesystem' entry must not fire.
    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.swapped-mcp-server',
      severity: 'high',
      file: '.mcp.json',
      summary: "MCP server 'fetch' definition changed (command)",
      detail:
        "The already-approved MCP server 'fetch' in .mcp.json had its command modified " +
        'between the base and head branches. Silently repointing a trusted, previously ' +
        'reviewed MCP tool to a different command, argument set, or pinned version is the ' +
        'MCPoison attack pattern (CVE-2025-54136): a rug-pull on an entry that has already ' +
        'passed review, used to achieve persistent remote code execution.',
    });
  });

  it('produces zero findings when no server entry changed (fixture)', () => {
    const beforeContent = readFixture('no-change', 'before.json');
    const afterContent = readFixture('no-change', 'after.json');

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(0);
  });

  it("produces a high-severity finding when only args change (spec's 'arguments') (fixture)", () => {
    const beforeContent = readFixture('args-swap', 'before.json');
    const afterContent = readFixture('args-swap', 'after.json');

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('high');
    expect(findings[0].summary).toBe("MCP server 'filesystem' definition changed (args)");
  });

  it('does NOT fire on a newly added server (that is DD-1, not DD-2)', () => {
    const beforeContent = JSON.stringify({ mcpServers: { s1: { command: 'node' } } });
    const afterContent = JSON.stringify({
      mcpServers: { s1: { command: 'node' }, s2: { command: 'python' } },
    });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(0);
  });

  it('does NOT fire on a removed server (present in base, absent in head)', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { s1: { command: 'node' }, s2: { command: 'python' } },
    });
    const afterContent = JSON.stringify({ mcpServers: { s1: { command: 'node' } } });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(0);
  });

  it('fires when a pinned version field changes on an existing entry', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { db: { command: 'node', version: '1.2.3' } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { db: { command: 'node', version: '9.9.9' } },
    });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 'db' definition changed (version)");
  });

  it('fires when a pinned hash field changes on an existing entry', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { db: { command: 'node', hash: 'sha256:aaa' } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { db: { command: 'node', hash: 'sha256:bbb' } },
    });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 'db' definition changed (hash)");
  });

  it('reports every changed pinned field for a single entry', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['a'] } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { s1: { command: 'node', args: ['b'] } },
    });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 's1' definition changed (command, args)");
  });

  it('treats args comparison as order-sensitive', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['-y', 'pkg', '/tmp'] } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['-y', '/tmp', 'pkg'] } },
    });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 's1' definition changed (args)");
  });

  it('fires when a pinned field is removed from an existing entry', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { s1: { command: 'node', args: ['server.js'] } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { s1: { command: 'node' } },
    });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 's1' definition changed (args)");
  });

  it('supports the "servers" top-level key as well as "mcpServers"', () => {
    const beforeContent = JSON.stringify({ servers: { s1: { command: 'node' } } });
    const afterContent = JSON.stringify({ servers: { s1: { command: 'python' } } });

    const findings = detectSwappedMcpServer('claude_desktop_config.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('high');
  });

  it('returns zero findings when base is null (newly added file: all entries are adds)', () => {
    const afterContent = JSON.stringify({ mcpServers: { s1: { command: 'node' } } });

    expect(detectSwappedMcpServer('.mcp.json', null, afterContent)).toHaveLength(0);
  });

  it('returns zero findings when head is null (file deleted)', () => {
    const beforeContent = JSON.stringify({ mcpServers: { s1: { command: 'node' } } });

    expect(detectSwappedMcpServer('.mcp.json', beforeContent, null)).toHaveLength(0);
  });

  it('fails open (zero findings) when base content is malformed JSON', () => {
    const afterContent = JSON.stringify({ mcpServers: { s1: { command: 'node' } } });

    expect(detectSwappedMcpServer('.mcp.json', '{ malformed', afterContent)).toHaveLength(0);
  });

  it('fails open (zero findings) when head content is malformed JSON', () => {
    const beforeContent = JSON.stringify({ mcpServers: { s1: { command: 'node' } } });

    expect(detectSwappedMcpServer('.mcp.json', beforeContent, '{ malformed')).toHaveLength(0);
  });

  it('fails open (zero findings) when content is a valid JSON primitive or array', () => {
    const valid = JSON.stringify({ mcpServers: { s1: { command: 'node' } } });
    expect(detectSwappedMcpServer('.mcp.json', valid, '[1, 2, 3]')).toHaveLength(0);
    expect(detectSwappedMcpServer('.mcp.json', '"hello"', valid)).toHaveLength(0);
    expect(detectSwappedMcpServer('.mcp.json', valid, '123')).toHaveLength(0);
  });
});
