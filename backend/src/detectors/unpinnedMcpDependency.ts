import { Finding } from '../types';

// Mirrors DD-1/DD-2's own parseMcpServerEntries: both "mcpServers" and
// "servers" are read and merged, "mcpServers" winning on a name collision,
// duplicated locally rather than imported since this task is scoped to
// touching only this file.
function parseMcpServerEntries(content: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const merged: Record<string, unknown> = {};

    for (const candidate of [obj.servers, obj.mcpServers]) {
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        Object.assign(merged, candidate);
      }
    }

    return merged;
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

// An npm package specifier is pinned when it carries an explicit "@version"
// suffix. Scoped packages ("@scope/name") already start with one "@" for the
// scope itself, so that leading character is stripped before checking for a
// second "@" -- otherwise every scoped package would read as "pinned" on its
// scope marker alone.
function isPinnedPackageSpec(spec: string): boolean {
  const withoutScope = spec.startsWith('@') ? spec.slice(1) : spec;
  return withoutScope.includes('@');
}

// The package being run is the first argument that isn't itself a flag
// (e.g. "-y" ahead of it). Anything after the package (server-specific args
// like a working directory) is irrelevant to identifying what's unpinned.
function findPackageSpec(args: unknown): string | null {
  if (!Array.isArray(args)) {
    return null;
  }
  const packageArg = args.find(
    (arg): arg is string => typeof arg === 'string' && !arg.startsWith('-')
  );
  return packageArg ?? null;
}

// Current-state check like RF-1/RF-2, not a diff: an unpinned server is a
// live risk on every PR it's still present in, not just the PR that added or
// changed it, so this only ever looks at head content.
export function detectUnpinnedMcpDependency(
  filePath: string,
  headContent: string | null
): Finding[] {
  if (!headContent) {
    return [];
  }

  const entries = parseMcpServerEntries(headContent);
  if (!entries) {
    return [];
  }

  const findings: Finding[] = [];

  for (const [serverName, definition] of Object.entries(entries)) {
    if (getField(definition, 'command') !== 'npx') {
      continue;
    }

    const packageSpec = findPackageSpec(getField(definition, 'args'));
    if (packageSpec === null || isPinnedPackageSpec(packageSpec)) {
      continue;
    }

    findings.push({
      detectorId: 'diff-drift.unpinned-mcp-dependency',
      severity: 'warning',
      file: filePath,
      summary: `MCP server '${serverName}' installs '${packageSpec}' via npx with no version pin`,
      detail: `The MCP server '${serverName}' in ${filePath} runs '${packageSpec}' via npx with no pinned version. Without an explicit version (e.g. '${packageSpec}@1.2.3'), npx always resolves to whatever release is currently published on the registry, so a compromised or malicious package update reaches every agent invocation immediately, with no PR for anyone to review.`,
    });
  }

  return findings;
}
