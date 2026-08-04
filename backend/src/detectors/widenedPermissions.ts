import { Finding } from '../types';

// A permission string is "widened by wildcard" when it contains this character:
// a wildcard grants an open-ended class of actions rather than a single reviewed
// one, so an added allow entry carrying it escalates from warning to high.
const WILDCARD_CHAR = '*';

interface Permissions {
  allow: string[];
  deny: string[];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === 'string');
}

// Reads the permissions block out of .claude/settings.json. Returns null on
// malformed / non-object JSON (fail-open: the caller reports nothing), and an
// empty allow/deny pair when the permissions object is absent or the wrong shape.
function parsePermissions(content: string): Permissions | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const permissions = obj.permissions;

    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
      return { allow: [], deny: [] };
    }

    const permObj = permissions as Record<string, unknown>;
    return {
      allow: toStringArray(permObj.allow),
      deny: toStringArray(permObj.deny),
    };
  } catch {
    return null;
  }
}

export function detectWidenedPermissions(
  filePath: string,
  baseContent: string | null,
  headContent: string | null
): Finding[] {
  // DD-3 compares an existing permission set against its successor. With either
  // side absent there is no before/after pair to widen, so nothing to report.
  if (baseContent === null || headContent === null) {
    return [];
  }

  const base = parsePermissions(baseContent);
  const head = parsePermissions(headContent);
  if (!base || !head) {
    return [];
  }

  const findings: Finding[] = [];
  const baseAllow = new Set(base.allow);
  const headDeny = new Set(head.deny);

  // Widening (1) & (3): allow entries present in head but not base. A wildcard
  // in the newly added entry escalates the finding to high; anything else is a
  // warning. Removing an allow entry is a narrowing change and is ignored.
  for (const entry of new Set(head.allow)) {
    if (baseAllow.has(entry)) {
      continue;
    }

    if (entry.includes(WILDCARD_CHAR)) {
      findings.push({
        detectorId: 'diff-drift.widened-permissions',
        severity: 'high',
        file: filePath,
        summary: `Wildcard permission '${entry}' added to allow-list`,
        detail: `The head branch adds the wildcard permission '${entry}' to the allow-list in ${filePath}. A wildcard grants a broad, open-ended class of actions rather than a single reviewed one, sharply widening the agent's unprompted execution surface.`,
      });
    } else {
      findings.push({
        detectorId: 'diff-drift.widened-permissions',
        severity: 'warning',
        file: filePath,
        summary: `Permission '${entry}' added to allow-list`,
        detail: `The head branch adds '${entry}' to the allow-list in ${filePath}. This widens what the agent is permitted to do without approval; a broader allow-list means more actions run unprompted.`,
      });
    }
  }

  // Widening (2): deny rules present in base but removed in head. Adding a deny
  // rule is a narrowing change and is ignored.
  for (const entry of new Set(base.deny)) {
    if (!headDeny.has(entry)) {
      findings.push({
        detectorId: 'diff-drift.widened-permissions',
        severity: 'warning',
        file: filePath,
        summary: `Deny rule '${entry}' removed`,
        detail: `The head branch removes the deny rule '${entry}' from ${filePath}. Removing a deny rule lifts a restriction that previously blocked the agent from performing that action, widening what it is allowed to do.`,
      });
    }
  }

  return findings;
}
