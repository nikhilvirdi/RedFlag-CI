import * as fs from 'fs';
import * as path from 'path';
import { detectSwappedMcpServer, splitArgs } from './swappedMcpServer';

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

  it('treats args comparison as order-sensitive for purely positional arguments', () => {
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

  it('produces zero findings when only flagged arguments are reordered (fixture)', () => {
    // Closes the near-miss-args-reorder false positive: "-y" (positional,
    // single-dash) stays last-before-the-package-name in both orderings;
    // only "--verbose" (a flagged argument) moves relative to it, which is
    // cosmetic, not drift.
    const beforeContent = readFixture('args-reorder-flags-only', 'before.json');
    const afterContent = readFixture('args-reorder-flags-only', 'after.json');

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(0);
  });

  it('still fires when a positional flag value moves before its flag (fixture)', () => {
    // judgment-dd2-args-reorder-with-real-semantics: "--config" goes from
    // immediately followed by "/etc/app.conf" (has a value) to immediately
    // followed by "--verbose" (no value at all) -- a genuine argument-parsing
    // break, not a cosmetic reorder. Must keep firing after this task.
    const beforeContent = readFixture('args-reorder-real-semantics', 'before.json');
    const afterContent = readFixture('args-reorder-real-semantics', 'after.json');

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 'deploy' definition changed (args)");
  });

  it('compares self-contained "--key=value" flagged arguments unordered', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['pkg', '--timeout=30', '--retries=3'] } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['pkg', '--retries=3', '--timeout=30'] } },
    });

    expect(detectSwappedMcpServer('.mcp.json', beforeContent, afterContent)).toHaveLength(0);
  });

  it('still fires when a flagged argument value actually changes, reorder aside', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['pkg', '--timeout=30'] } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['--timeout=90', 'pkg'] } },
    });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 's1' definition changed (args)");
  });

  it('still fires when a flagged argument is genuinely added, not just reordered', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['-y', 'pkg'] } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['-y', 'pkg', '--allow-write'] } },
    });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 's1' definition changed (args)");
  });

  it('falls back to exact comparison when args is not a clean string array', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['-y', 42, 'pkg'] } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { s1: { command: 'npx', args: ['pkg', 42, '-y'] } },
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

  it('merges "mcpServers" and "servers" instead of the first present short-circuiting the other (fixture)', () => {
    // Task 6.4: the same ?? short-circuit bug Task 2.1 fixed on
    // newMcpServer.ts, re-surfaced here: an empty-but-present "mcpServers"
    // ({}) is truthy, so `mcpServers ?? servers` picked it and made
    // "servers" invisible entirely -- not just when "mcpServers" was
    // absent. A command/args swap on a "servers"-only entry was silently
    // missed as a result.
    const beforeContent = readFixture('both-schema-keys-present', 'before.json');
    const afterContent = readFixture('both-schema-keys-present', 'after.json');

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 'filesystem' definition changed (args)");
  });

  it('still reads "servers" when "mcpServers" is present but malformed (not an object)', () => {
    const beforeContent = JSON.stringify({
      mcpServers: 'not-an-object',
      servers: { s1: { command: 'node' } },
    });
    const afterContent = JSON.stringify({
      mcpServers: 'not-an-object',
      servers: { s1: { command: 'python' } },
    });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(1);
    expect(findings[0].summary).toBe("MCP server 's1' definition changed (command)");
  });

  it('lets "mcpServers" win over "servers" on a genuine name collision, suppressing a change made only on the "servers" side', () => {
    const beforeContent = JSON.stringify({
      mcpServers: { s1: { command: 'trusted' } },
      servers: { s1: { command: 'shadow-before' } },
    });
    const afterContent = JSON.stringify({
      mcpServers: { s1: { command: 'trusted' } },
      servers: { s1: { command: 'shadow-after' } },
    });

    const findings = detectSwappedMcpServer('.mcp.json', beforeContent, afterContent);

    expect(findings).toHaveLength(0);
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

  it('Task 5.8: still finds the base entry and detects a real command swap when the key is expressed in a different Unicode normalization form (fixture)', () => {
    // before.json's key is NFD; after.json's is the NFC form of the same
    // logical key, AND the command genuinely changes -- proves the base
    // entry is still looked up correctly (not silently treated as a
    // same-name addition with nothing to diff against), not just that
    // "nothing changed" trivially produces no finding.
    const findings = detectSwappedMcpServer(
      '.mcp.json',
      readFixture('nfc-nfd-key-still-detects-swap', 'before.json'),
      readFixture('nfc-nfd-key-still-detects-swap', 'after.json')
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].detectorId).toBe('diff-drift.swapped-mcp-server');
    expect(findings[0].summary).toContain('definition changed (command)');
  });

  describe('Task 6.5: splitArgs token construction has no embedded control characters', () => {
    // Guards against a regression of a real bug found in this file: the
    // space in `${token} ${hasValue}` had been a stray NUL byte on disk
    // since Task 3.4, undetected until now. Two independent reasons no test
    // ever caught it: both sides of every DD-2 comparison built the
    // identical string either way (so no finding ever changed), AND
    // TypeScript's compiler silently sanitized the NUL into a space during
    // compilation, so even the *runtime* string was never actually wrong.
    // The runtime-string assertions below are still worth keeping (general
    // correctness coverage), but the source-byte test after them is the
    // only one of the two that would actually have caught this bug --
    // confirmed by reverting the fix and re-running both kinds during this
    // task: the runtime-string tests kept passing, only the byte-level one
    // failed.
    // Char-code check rather than a /[\x00-\x1F\x7F]/ regex literal, which
    // ESLint's no-control-regex rule (correctly) flags as suspicious.
    function hasControlChar(s: string): boolean {
      return [...s].some((ch) => {
        const code = ch.charCodeAt(0);
        return code < 32 || code === 127;
      });
    }

    it('joins a bare flag and its value-presence marker with a plain space, no control characters', () => {
      const { flagged } = splitArgs(['--config', '/etc/app.conf']);

      expect(flagged).toEqual(['--config true']);
      expect(hasControlChar(flagged[0])).toBe(false);
    });

    it('does the same for a bare flag with no following value', () => {
      const { flagged } = splitArgs(['--verbose']);

      expect(flagged).toEqual(['--verbose false']);
      expect(hasControlChar(flagged[0])).toBe(false);
    });

    it('never embeds a control character in any flagged token, across every splitArgs code path', () => {
      const { flagged } = splitArgs(['--timeout=30', '--config', '/etc/app.conf', '--verbose', 'pkg']);

      expect(flagged.length).toBeGreaterThan(0);
      for (const token of flagged) {
        expect(hasControlChar(token)).toBe(false);
      }
    });

    it('has no embedded NUL byte anywhere in the .ts source file itself', () => {
      // The actual guard: TypeScript quietly repairs a NUL inside a
      // template literal at compile time, so a runtime-string check alone
      // (above) can never detect this class of regression. Only reading
      // the source file's raw bytes can.
      const sourcePath = path.join(__dirname, 'swappedMcpServer.ts');
      const raw = fs.readFileSync(sourcePath);

      expect(raw.includes(0)).toBe(false);
    });
  });
});
