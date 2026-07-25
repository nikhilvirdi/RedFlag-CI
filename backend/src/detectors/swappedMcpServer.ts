import { Finding } from '../types';

// Fields on a single MCP server entry that pin its identity: what runs
// (command), how it runs (args), and any explicit version/hash pin. A change
// to any of these on an already-approved entry is the MCPoison rug-pull.
const PINNED_FIELDS = ['command', 'args', 'version', 'hash'] as const;

function parseMcpServerEntries(content: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const serverObj = obj.mcpServers ?? obj.servers;

    if (!serverObj || typeof serverObj !== 'object' || Array.isArray(serverObj)) {
      return {};
    }

    return serverObj as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getField(entry: unknown, field: string): unknown {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return undefined;
  }
  return (entry as Record<string, unknown>)[field];
}

// Order-sensitive comparison: args are positional CLI arguments, so a reorder
// can change execution semantics and is worth surfacing as drift. JSON.stringify
// preserves array order, giving exact element-by-element comparison for arrays
// and plain equality for the scalar fields.
function fieldChanged(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function detectSwappedMcpServer(
  filePath: string,
  baseContent: string | null,
  headContent: string | null
): Finding[] {
  // DD-2 fires only on modification of an entry present in BOTH versions. If
  // either version is absent, every entry is a pure add or delete, which is
  // not DD-2's concern.
  if (baseContent === null || headContent === null) {
    return [];
  }

  const baseServers = parseMcpServerEntries(baseContent);
  const headServers = parseMcpServerEntries(headContent);
  if (!baseServers || !headServers) {
    return [];
  }

  const findings: Finding[] = [];

  for (const serverName of Object.keys(headServers)) {
    // Present in head but not base => addition (DD-1's job), not a swap.
    if (!Object.prototype.hasOwnProperty.call(baseServers, serverName)) {
      continue;
    }

    const baseEntry = baseServers[serverName];
    const headEntry = headServers[serverName];

    const changedFields = PINNED_FIELDS.filter((field) =>
      fieldChanged(getField(baseEntry, field), getField(headEntry, field))
    );

    if (changedFields.length > 0) {
      const changed = changedFields.join(', ');
      findings.push({
        detectorId: 'diff-drift.swapped-mcp-server',
        severity: 'high',
        file: filePath,
        summary: `MCP server '${serverName}' definition changed (${changed})`,
        detail: `The already-approved MCP server '${serverName}' in ${filePath} had its ${changed} modified between the base and head branches. Silently repointing a trusted, previously reviewed MCP tool to a different command, argument set, or pinned version is the MCPoison attack pattern (CVE-2025-54136): a rug-pull on an entry that has already passed review, used to achieve persistent remote code execution.`,
      });
    }
  }

  return findings;
}
