import * as fs from 'fs';
import * as path from 'path';
import { detectTransportTypeChange } from './transportTypeChange';

describe('Task 5.7: detectTransportTypeChange', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'transport-type-change');
  const filePath = '.mcp.json';

  const readFixture = (name: string, file: 'before.json' | 'after.json'): string =>
    fs.readFileSync(path.join(fixturesDir, name, file), 'utf-8');

  it('fires a HIGH-severity finding when a server changes from local to remote (fixture)', () => {
    const findings = detectTransportTypeChange(
      filePath,
      readFixture('local-to-remote', 'before.json'),
      readFixture('local-to-remote', 'after.json')
    );

    // Only 'search' changed transport; the untouched 'filesystem' entry must not fire.
    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.transport-type-change',
      severity: 'high',
      file: filePath,
      summary: "MCP server 'search' transport changed from local (command-based, stdio) to remote (url/transport-based)",
      detail:
        "The MCP server 'search' in .mcp.json changed from local (command-based, stdio) to " +
        'remote (url/transport-based) between the base and head branches. This is a ' +
        "trust-boundary jump independent of any single field's value: a locally-run process " +
        'executes with local privileges and is visible in this repo, while a remote endpoint ' +
        'executes outside your control and receives whatever the agent sends it -- swapping ' +
        'between the two, in either direction, silently changes what an already-approved server ' +
        'actually does.',
    });
  });

  it('fires a HIGH-severity finding when a server changes from remote to local -- documented call: both directions are flagged (fixture)', () => {
    const findings = detectTransportTypeChange(
      filePath,
      readFixture('remote-to-local', 'before.json'),
      readFixture('remote-to-local', 'after.json')
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].detectorId).toBe('diff-drift.transport-type-change');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].summary).toBe(
      "MCP server 'analytics' transport changed from remote (url/transport-based) to local (command-based, stdio)"
    );
  });

  it('produces zero findings when no server changes transport shape (fixture)', () => {
    // 'filesystem' stays local (only its args version bumped) and
    // 'remote-search' stays remote (only its url value changed) -- DD-2's
    // job, not this detector's, and correctly silent here either way.
    const findings = detectTransportTypeChange(
      filePath,
      readFixture('no-transport-change', 'before.json'),
      readFixture('no-transport-change', 'after.json')
    );

    expect(findings).toHaveLength(0);
  });

  it('does not fire on a brand-new server, even one with a "remote" shape (that is DD-1, not this detector)', () => {
    const before = JSON.stringify({ mcpServers: {} });
    const after = JSON.stringify({
      mcpServers: { newRemote: { url: 'https://mcp.example.com/new' } },
    });

    expect(detectTransportTypeChange('.mcp.json', before, after)).toHaveLength(0);
  });

  it('does not fire on a removed server', () => {
    const before = JSON.stringify({
      mcpServers: { gone: { command: 'npx', args: ['old-server'] } },
    });
    const after = JSON.stringify({ mcpServers: {} });

    expect(detectTransportTypeChange('.mcp.json', before, after)).toHaveLength(0);
  });

  it('does not fire on an entry with both "command" and "url" present on either side (ambiguous hybrid shape, not guessed at)', () => {
    const before = JSON.stringify({
      mcpServers: { hybrid: { command: 'npx', args: ['a'], url: 'https://mcp.example.com/a' } },
    });
    const after = JSON.stringify({
      mcpServers: { hybrid: { command: 'node', args: ['b'], url: 'https://mcp.example.com/b' } },
    });

    expect(detectTransportTypeChange('.mcp.json', before, after)).toHaveLength(0);
  });

  it('treats a "transport" field alone (no "url") as a remote shape', () => {
    const before = JSON.stringify({
      mcpServers: { server: { command: 'npx', args: ['-y', 'pkg'] } },
    });
    const after = JSON.stringify({
      mcpServers: { server: { transport: 'sse' } },
    });

    const findings = detectTransportTypeChange('.mcp.json', before, after);

    expect(findings).toHaveLength(1);
  });

  it('detects multiple transport changes across different servers in the same file', () => {
    const before = JSON.stringify({
      mcpServers: {
        a: { command: 'npx', args: ['a'] },
        b: { url: 'https://mcp.example.com/b' },
        c: { command: 'npx', args: ['c'] },
      },
    });
    const after = JSON.stringify({
      mcpServers: {
        a: { url: 'https://mcp.example.com/a' },
        b: { command: 'node', args: ['b.js'] },
        c: { command: 'npx', args: ['c-updated'] },
      },
    });

    const findings = detectTransportTypeChange('.mcp.json', before, after);

    expect(findings).toHaveLength(2);
    const summaries = findings.map((f) => f.summary);
    expect(summaries).toContain(
      "MCP server 'a' transport changed from local (command-based, stdio) to remote (url/transport-based)"
    );
    expect(summaries).toContain(
      "MCP server 'b' transport changed from remote (url/transport-based) to local (command-based, stdio)"
    );
  });

  it('produces zero findings when baseContent is null (file newly added in head)', () => {
    const after = JSON.stringify({ mcpServers: { a: { url: 'https://mcp.example.com/a' } } });
    expect(detectTransportTypeChange('.mcp.json', null, after)).toHaveLength(0);
  });

  it('produces zero findings when headContent is null (file deleted in head)', () => {
    const before = JSON.stringify({ mcpServers: { a: { command: 'npx', args: ['a'] } } });
    expect(detectTransportTypeChange('.mcp.json', before, null)).toHaveLength(0);
  });

  it('fails open (returns 0 findings) when base or head is malformed JSON', () => {
    const valid = JSON.stringify({ mcpServers: { a: { command: 'npx' } } });
    expect(detectTransportTypeChange('.mcp.json', '{ invalid', valid)).toHaveLength(0);
    expect(detectTransportTypeChange('.mcp.json', valid, '{ invalid')).toHaveLength(0);
  });

  it('supports "servers" top-level key as well as "mcpServers"', () => {
    const before = JSON.stringify({ servers: { api: { command: 'node', args: ['api.js'] } } });
    const after = JSON.stringify({ servers: { api: { url: 'https://mcp.example.com/api' } } });

    const findings = detectTransportTypeChange('claude_desktop_config.json', before, after);

    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe('claude_desktop_config.json');
  });

  // Regression: parseMcpServerEntries previously used `mcpServers ?? servers`,
  // which made "servers" invisible whenever "mcpServers" was present at all,
  // even non-collidingly populated (the same bug Task 2.1 fixed on DD-1 --
  // see judgment-dd1-both-schema-keys-present). Both keys here are present,
  // with entirely different, non-colliding server names, so the old
  // short-circuit would have silently dropped the "servers"-side entry and
  // missed its transport change entirely.
  it('detects a transport change on a "servers"-keyed entry when a non-colliding "mcpServers" key is also present', () => {
    const before = JSON.stringify({
      mcpServers: { api: { command: 'node', args: ['api.js'] } },
      servers: { legacy: { command: 'node', args: ['legacy.js'] } },
    });
    const after = JSON.stringify({
      mcpServers: { api: { command: 'node', args: ['api.js'] } },
      servers: { legacy: { url: 'https://mcp.example.com/legacy' } },
    });

    const findings = detectTransportTypeChange('.mcp.json', before, after);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe(
      "MCP server 'legacy' transport changed from local (command-based, stdio) to remote (url/transport-based)"
    );
  });

  it('Task 5.8: still finds the base entry and detects a real transport change when the key is expressed in a different Unicode normalization form (fixture)', () => {
    // before.json's key is NFD; after.json's is the NFC form of the same
    // logical key, AND the transport genuinely changes local -> remote --
    // proves the base entry is still looked up correctly, not just that
    // "nothing changed" trivially produces no finding.
    const findings = detectTransportTypeChange(
      filePath,
      readFixture('nfc-nfd-key-still-detects-change', 'before.json'),
      readFixture('nfc-nfd-key-still-detects-change', 'after.json')
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].detectorId).toBe('diff-drift.transport-type-change');
    expect(findings[0].summary).toContain('local (command-based, stdio) to remote (url/transport-based)');
  });
});
