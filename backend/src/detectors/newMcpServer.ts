import { Finding } from '../types';

function parseMcpServers(content: string): Set<string> | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const merged: Record<string, unknown> = {};

    // Both "mcpServers" and "servers" are real top-level key names different
    // MCP clients use (architecture.md 5); a config carrying both must have
    // both read, not just the first one found. `??` here previously
    // short-circuited on any non-nullish `mcpServers` -- including `{}` --
    // so a real entry added under "servers" went completely undetected
    // whenever "mcpServers" was present at all, even empty (the
    // judgment-dd1-both-schema-keys-present gap). Iterating "servers" first
    // and "mcpServers" second means a name collision between the two
    // resolves to "mcpServers" winning: an explicit, deterministic
    // precedence rather than depending on object key insertion order. Either
    // side being malformed (not an object, or an array) is skipped rather
    // than discarding the whole parse, consistent with this detector's
    // fail-open design (architecture.md 2) applying per-key, not per-file.
    for (const candidate of [obj.servers, obj.mcpServers]) {
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        Object.assign(merged, candidate);
      }
    }

    return new Set<string>(Object.keys(merged));
  } catch {
    return null;
  }
}

export function detectNewMcpServer(
  filePath: string,
  baseContent: string | null,
  headContent: string | null
): Finding[] {
  if (!headContent) {
    return [];
  }

  const headServers = parseMcpServers(headContent);
  if (!headServers) {
    return [];
  }

  let baseServers = new Set<string>();
  if (baseContent !== null) {
    const parsedBase = parseMcpServers(baseContent);
    if (!parsedBase) {
      return [];
    }
    baseServers = parsedBase;
  }

  const findings: Finding[] = [];

  for (const serverName of headServers) {
    if (!baseServers.has(serverName)) {
      findings.push({
        detectorId: 'diff-drift.new-mcp-server',
        severity: 'warning',
        file: filePath,
        summary: `New MCP server '${serverName}' added`,
        detail: `The head branch adds a new MCP server entry '${serverName}' to ${filePath}. Adding new MCP servers widens the tool execution surface area available to AI agents.`,
      });
    }
  }

  return findings;
}
