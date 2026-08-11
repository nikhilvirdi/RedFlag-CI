import { Finding } from '../types';
import { correlateRemovedAdded } from '../correlateRemovedAdded';
import { normalizeUnicode, normalizeDeep } from '../unicodeNormalize';

// Mirrors DD-2's PINNED_FIELDS (swappedMcpServer.ts) -- what runs (command),
// how it runs (args, env), and any explicit version/hash pin -- duplicated
// here rather than imported, since this task is scoped to touching only
// this file and DD-2 doesn't currently export the constant. Both detectors
// independently agree on what "the same server" means at the field level,
// which is also this task's own instruction: "everything DD-2 already
// considers pinned."
const IDENTITY_FIELDS = ['command', 'args', 'version', 'hash', 'env'] as const;

function parseMcpServerEntries(content: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const merged: Record<string, unknown> = {};

    // Same merge behavior Task 2.1 fixed on this detector: both
    // "mcpServers" and "servers" are read and merged, "mcpServers" winning
    // on a name collision, a malformed side skipped rather than the whole
    // parse being discarded.
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

interface ServerCandidate {
  name: string;
  definition: unknown;
}

// Same server, different key: every identity field matches exactly.
// Order-sensitive for the "args" array (JSON.stringify preserves order),
// matching DD-2's own comparison semantics -- a rename shouldn't also
// silently swallow a simultaneous positional-argument reorder underneath it.
// Compared through normalizeDeep (Task 5.8) so two otherwise-identical
// fields expressed in different Unicode normalization forms (e.g. an env
// value or an arg string using NFD instead of NFC) still correlate as the
// same rename, rather than spuriously failing to match on byte differences
// invisible to a human reviewer.
function isSameServerDefinition(removed: ServerCandidate, added: ServerCandidate): boolean {
  return IDENTITY_FIELDS.every(
    (field) =>
      JSON.stringify(normalizeDeep(getField(removed.definition, field))) ===
      JSON.stringify(normalizeDeep(getField(added.definition, field)))
  );
}

export function detectNewMcpServer(
  filePath: string,
  baseContent: string | null,
  headContent: string | null
): Finding[] {
  if (headContent === null) {
    return [];
  }

  const headEntries = parseMcpServerEntries(headContent);
  if (!headEntries) {
    return [];
  }

  let baseEntries: Record<string, unknown> = {};
  if (baseContent !== null) {
    const parsedBase = parseMcpServerEntries(baseContent);
    if (!parsedBase) {
      return [];
    }
    baseEntries = parsedBase;
  }

  const baseNames = Object.keys(baseEntries);
  const headNames = Object.keys(headEntries);

  // Membership is checked on normalized names (Task 5.8) -- a server key
  // expressed in two different Unicode normalization forms between base and
  // head is the same key to a human reviewer, and must not read as a
  // removal+addition pair. The candidate lists themselves still carry each
  // side's original, un-normalized name (for display and for indexing back
  // into baseEntries/headEntries, which are keyed by the raw JSON text).
  const normalizedBaseNames = new Set(baseNames.map(normalizeUnicode));
  const normalizedHeadNames = new Set(headNames.map(normalizeUnicode));

  const removedCandidates: ServerCandidate[] = baseNames
    .filter((name) => !normalizedHeadNames.has(normalizeUnicode(name)))
    .map((name) => ({ name, definition: baseEntries[name] }));
  const addedCandidates: ServerCandidate[] = headNames
    .filter((name) => !normalizedBaseNames.has(normalizeUnicode(name)))
    .map((name) => ({ name, definition: headEntries[name] }));

  // A removed+added pair whose identity fields match exactly reads as a
  // rename of an already-trusted entry, not a brand-new, unreviewed one
  // (closes the near-miss-mcp-server-rename false positive; see
  // docs/adr/0001-deterministic-only-v1.md). architecture.md section 5's
  // DD-1 spec is silent on renames -- it's written purely in add/remove
  // terms, with no third "renamed" finding type -- so this is a judgment
  // call, made explicitly here: a correlated rename produces NO finding at
  // all, rather than a new, distinct, lower-severity "server renamed"
  // finding. Reasoning: nothing about a rename with byte-identical
  // command/args/version/hash/env is itself risky -- the capability DD-1
  // exists to catch (a new, unreviewed tool entering the config) simply
  // isn't present here, and the near-miss fixture's own documented ground
  // truth is "should stay quiet," not "should report something new." A pair
  // that does NOT match on every identity field is never correlated, so it
  // still reports as a new server below -- same as any add with no removal
  // to correlate against at all. This only ever suppresses a genuinely
  // identical rename; a same-name-different-command swap is DD-2's job, and
  // a same-name-different-args change still reports here as new.
  const { unmatchedAdded } = correlateRemovedAdded(
    removedCandidates,
    addedCandidates,
    isSameServerDefinition
  );

  const findings: Finding[] = [];

  for (const { name: serverName } of unmatchedAdded) {
    findings.push({
      detectorId: 'diff-drift.new-mcp-server',
      severity: 'warning',
      file: filePath,
      summary: `New MCP server '${serverName}' added`,
      detail: `The head branch adds a new MCP server entry '${serverName}' to ${filePath}. Adding new MCP servers widens the tool execution surface area available to AI agents.`,
    });
  }

  return findings;
}
