import * as fs from 'fs';
import * as path from 'path';
import { detectSuspiciousNetworkTarget } from './suspiciousNetworkTarget';

describe('Task 5.5: detectSuspiciousNetworkTarget', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'suspicious-network-target');
  const filePath = '.mcp.json';

  const readFixture = (name: string): string =>
    fs.readFileSync(path.join(fixturesDir, name, '.mcp.json'), 'utf-8');

  it('fires a WARNING-severity finding for a bare IP literal in args (fixture)', () => {
    const findings = detectSuspiciousNetworkTarget(filePath, readFixture('bare-ip'));

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.suspicious-network-target',
      severity: 'warning',
      file: filePath,
      summary: "MCP server 'remote-db' uses bare IP target '192.168.1.1'",
      detail:
        "The MCP server 'remote-db' in .mcp.json configures bare IP target '192.168.1.1'. " +
        'Hardcoding bare IP addresses bypasses domain name validation, TLS certificate ' +
        'verification, and standard DNS governance.',
    });
  });

  it('fires a WARNING-severity finding for a non-HTTPS http:// URL in env (fixture)', () => {
    const findings = detectSuspiciousNetworkTarget(filePath, readFixture('http-url'));

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.suspicious-network-target',
      severity: 'warning',
      file: filePath,
      summary: "MCP server 'insecure-api' uses insecure HTTP target 'http://api.example.com/v1'",
      detail:
        "The MCP server 'insecure-api' in .mcp.json configures non-HTTPS target 'http://api.example.com/v1'. " +
        'Using unencrypted HTTP exposes network traffic and credentials to interception or tampering.',
    });
  });

  it('produces zero findings when the MCP server uses an https:// URL (fixture)', () => {
    const findings = detectSuspiciousNetworkTarget(filePath, readFixture('https-url'));

    expect(findings).toHaveLength(0);
  });

  it('produces zero findings for local targets like localhost / 127.0.0.1 / 0.0.0.0 (fixture)', () => {
    const findings = detectSuspiciousNetworkTarget(filePath, readFixture('localhost'));

    expect(findings).toHaveLength(0);
  });

  it('is a current-state check: fires on head content alone with no base argument', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        server: { command: 'node', args: ['10.0.0.1'] },
      },
    });

    const findings = detectSuspiciousNetworkTarget('.mcp.json', headContent);

    expect(findings).toHaveLength(1);
  });

  it('detects bare IP in env values as well as args', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        server: { command: 'node', env: { DB_HOST: '172.16.0.5' } },
      },
    });

    const findings = detectSuspiciousNetworkTarget('.mcp.json', headContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 'server' uses bare IP target '172.16.0.5'");
  });

  it('detects non-HTTPS http:// URL in args as well as env', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        server: { command: 'node', args: ['--url=http://insecure-host.internal/api'] },
      },
    });

    const findings = detectSuspiciousNetworkTarget('.mcp.json', headContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe(
      "MCP server 'server' uses insecure HTTP target 'http://insecure-host.internal/api'"
    );
  });

  it('exempts http://localhost, http://127.0.0.1, and http://0.0.0.0 with optional ports', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        s1: { command: 'node', args: ['http://localhost:3000'] },
        s2: { command: 'node', args: ['http://127.0.0.1:8080/health'] },
        s3: { command: 'node', args: ['http://0.0.0.0:9000'] },
      },
    });

    expect(detectSuspiciousNetworkTarget('.mcp.json', headContent)).toHaveLength(0);
  });

  it('detects multiple suspicious targets across different servers', () => {
    const headContent = JSON.stringify({
      mcpServers: {
        a: { command: 'node', args: ['192.168.1.5'] },
        b: { command: 'node', args: ['https://secure.com'] },
        c: { command: 'node', env: { URL: 'http://plain-http.org' } },
      },
    });

    const findings = detectSuspiciousNetworkTarget('.mcp.json', headContent);

    expect(findings).toHaveLength(2);
    const summaries = findings.map((f) => f.summary);
    expect(summaries).toContain("MCP server 'a' uses bare IP target '192.168.1.5'");
    expect(summaries).toContain("MCP server 'c' uses insecure HTTP target 'http://plain-http.org'");
  });

  it('produces zero findings when headContent is null (file deleted in head)', () => {
    expect(detectSuspiciousNetworkTarget('.mcp.json', null)).toHaveLength(0);
  });

  it('fails open (returns 0 findings) when headContent is malformed JSON', () => {
    expect(detectSuspiciousNetworkTarget('.mcp.json', '{ invalid json')).toHaveLength(0);
  });

  it('fails open (returns 0 findings) when content is valid JSON primitive or array', () => {
    expect(detectSuspiciousNetworkTarget('.mcp.json', '[1, 2, 3]')).toHaveLength(0);
    expect(detectSuspiciousNetworkTarget('.mcp.json', '"hello"')).toHaveLength(0);
    expect(detectSuspiciousNetworkTarget('.mcp.json', '123')).toHaveLength(0);
    expect(detectSuspiciousNetworkTarget('.mcp.json', 'null')).toHaveLength(0);
    expect(detectSuspiciousNetworkTarget('.mcp.json', '')).toHaveLength(0);
  });

  it('supports "servers" top-level key as well as "mcpServers"', () => {
    const headContent = JSON.stringify({
      servers: {
        api: { command: 'node', args: ['10.0.0.99'] },
      },
    });

    const findings = detectSuspiciousNetworkTarget('claude_desktop_config.json', headContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe('claude_desktop_config.json');
  });
});
