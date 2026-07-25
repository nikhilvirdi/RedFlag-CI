import { Finding } from '../types';

function parseMcpServers(content: string): Set<string> | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const serverObj = obj.mcpServers ?? obj.servers;

    if (!serverObj || typeof serverObj !== 'object' || Array.isArray(serverObj)) {
      return new Set<string>();
    }

    return new Set<string>(Object.keys(serverObj));
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
