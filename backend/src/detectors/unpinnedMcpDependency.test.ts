import * as fs from 'fs';
import * as path from 'path';
import { detectUnpinnedMcpDependency } from './unpinnedMcpDependency';

describe('Task 5.1: detectUnpinnedMcpDependency', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'unpinned-mcp-dependency');
  const filePath = '.mcp.json';

  const readFixture = (name: string): string =>
    fs.readFileSync(path.join(fixturesDir, name, '.mcp.json'), 'utf-8');

  it('fires a WARNING-severity finding for an npx server with no version pin (fixture)', () => {
    const findings = detectUnpinnedMcpDependency(filePath, readFixture('unpinned'));

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.unpinned-mcp-dependency',
      severity: 'warning',
      file: filePath,
      summary: "MCP server 'fetch' installs 'mcp-server-fetch' via npx with no version pin",
      detail:
        "The MCP server 'fetch' in .mcp.json runs 'mcp-server-fetch' via npx with no pinned " +
        "version. Without an explicit version (e.g. 'mcp-server-fetch@1.2.3'), npx always " +
        'resolves to whatever release is currently published on the registry, so a compromised ' +
        'or malicious package update reaches every agent invocation immediately, with no PR for ' +
        'anyone to review.',
    });
  });

  it('produces zero findings when the same npx server is pinned to a version (fixture)', () => {
    const findings = detectUnpinnedMcpDependency(filePath, readFixture('pinned'));

    expect(findings).toHaveLength(0);
  });

  it('produces zero findings for a benign config: one pinned npx server, one non-npx server (fixture)', () => {
    const findings = detectUnpinnedMcpDependency(filePath, readFixture('benign'));

    expect(findings).toHaveLength(0);
  });

  it('is a current-state check: an unpinned server already present in head still fires with no base argument', () => {
    const headContent = JSON.stringify({
      mcpServers: { fetch: { command: 'npx', args: ['mcp-server-fetch'] } },
    });

    const findings = detectUnpinnedMcpDependency('.mcp.json', headContent);

    expect(findings).toHaveLength(1);
  });

  it('does not fire on a non-npx command (out of scope)', () => {
    const headContent = JSON.stringify({
      mcpServers: { fetch: { command: 'uvx', args: ['mcp-server-fetch'] } },
    });

    expect(detectUnpinnedMcpDependency('.mcp.json', headContent)).toHaveLength(0);
  });

  it('treats a scoped package with no version as unpinned', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
      },
    });

    const findings = detectUnpinnedMcpDependency('.mcp.json', headContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe(
      "MCP server 'filesystem' installs '@modelcontextprotocol/server-filesystem' via npx with no version pin"
    );
  });

  it('treats a scoped package with a version pin as pinned (scope "@" is not mistaken for a version marker)', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem@1.0.4'],
        },
      },
    });

    expect(detectUnpinnedMcpDependency('.mcp.json', headContent)).toHaveLength(0);
  });

  it('detects multiple unpinned servers in the same file', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        a: { command: 'npx', args: ['pkg-a'] },
        b: { command: 'npx', args: ['pkg-b@1.0.0'] },
        c: { command: 'npx', args: ['-y', 'pkg-c'] },
      },
    });

    const findings = detectUnpinnedMcpDependency('.mcp.json', headContent);

    expect(findings).toHaveLength(2);
    const summaries = findings.map((f) => f.summary);
    expect(summaries).toContain("MCP server 'a' installs 'pkg-a' via npx with no version pin");
    expect(summaries).toContain("MCP server 'c' installs 'pkg-c' via npx with no version pin");
  });

  it('produces zero findings when headContent is null (file deleted in head)', () => {
    expect(detectUnpinnedMcpDependency('.mcp.json', null)).toHaveLength(0);
  });

  it('fails open (returns 0 findings) when headContent is malformed JSON', () => {
    expect(detectUnpinnedMcpDependency('.mcp.json', '{ malformed json')).toHaveLength(0);
  });

  it('fails open (returns 0 findings) when content is valid JSON primitive or array', () => {
    expect(detectUnpinnedMcpDependency('.mcp.json', '[1, 2, 3]')).toHaveLength(0);
    expect(detectUnpinnedMcpDependency('.mcp.json', '"hello"')).toHaveLength(0);
    expect(detectUnpinnedMcpDependency('.mcp.json', '123')).toHaveLength(0);
    expect(detectUnpinnedMcpDependency('.mcp.json', 'null')).toHaveLength(0);
    expect(detectUnpinnedMcpDependency('.mcp.json', '')).toHaveLength(0);
  });

  it('produces zero findings when an npx server has no args at all', () => {
    const headContent = JSON.stringify({ mcpServers: { fetch: { command: 'npx' } } });

    expect(detectUnpinnedMcpDependency('.mcp.json', headContent)).toHaveLength(0);
  });

  it('produces zero findings when npx args are only flags (no identifiable package)', () => {
    const headContent = JSON.stringify({ mcpServers: { fetch: { command: 'npx', args: ['-y'] } } });

    expect(detectUnpinnedMcpDependency('.mcp.json', headContent)).toHaveLength(0);
  });

  // Regression: isPinnedPackageSpec previously accepted any "@something" as a
  // pin, including a floating dist-tag that resolves to whatever the
  // registry currently marks it as -- the same non-deterministic resolution
  // as no pin at all. "npx malicious-package@latest" read as pinned.
  it.each(['latest', 'next', 'canary', 'beta'])(
    'treats a floating dist-tag ("@%s") as unpinned, not a real pin',
    (tag) => {
      const headContent = JSON.stringify({
        mcpServers: { fetch: { command: 'npx', args: [`mcp-server-fetch@${tag}`] } },
      });

      const findings = detectUnpinnedMcpDependency('.mcp.json', headContent);

      expect(findings).toHaveLength(1);
      expect(findings[0].summary).toBe(
        `MCP server 'fetch' installs 'mcp-server-fetch@${tag}' via npx with no version pin`
      );
    }
  );

  it('still treats a real semver version as pinned (not swept up by the dist-tag rejection)', () => {
    const headContent = JSON.stringify({
      mcpServers: { fetch: { command: 'npx', args: ['mcp-server-fetch@1.2.3'] } },
    });

    expect(detectUnpinnedMcpDependency('.mcp.json', headContent)).toHaveLength(0);
  });

  it('treats a scoped package pinned to a floating dist-tag as unpinned', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem@latest'],
        },
      },
    });

    const findings = detectUnpinnedMcpDependency('.mcp.json', headContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe(
      "MCP server 'filesystem' installs '@modelcontextprotocol/server-filesystem@latest' via npx with no version pin"
    );
  });

  it('supports "servers" top-level key as well as "mcpServers"', () => {
    const headContent = JSON.stringify({ servers: { fetch: { command: 'npx', args: ['pkg'] } } });

    const findings = detectUnpinnedMcpDependency('claude_desktop_config.json', headContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe('claude_desktop_config.json');
  });
});
