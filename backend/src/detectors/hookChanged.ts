import { Finding } from '../types';

interface HookEntry {
  key: string;
  eventName: string;
  arrayIndex?: number;
  command: string;
}

// Reads the hooks array out of .claude/settings.json. Returns null on
// malformed / non-object JSON (fail-open: the caller reports nothing), and an
// empty array when the hooks section is absent or empty.
function parseHooks(content: string): HookEntry[] | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const hooksObj = obj.hooks;

    if (hooksObj === undefined) {
      return [];
    }

    const entries: HookEntry[] = [];

    if (Array.isArray(hooksObj)) {
      for (let i = 0; i < hooksObj.length; i++) {
        const item: unknown = hooksObj[i];
        if (typeof item === 'string') {
          entries.push({
            key: `hook[${i}]`,
            eventName: `hook[${i}]`,
            command: item,
          });
        } else if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const itemObj = item as Record<string, unknown>;
          const key =
            typeof itemObj.name === 'string'
              ? itemObj.name
              : typeof itemObj.event === 'string'
              ? itemObj.event
              : `hook[${i}]`;
          const cmd =
            typeof itemObj.command === 'string' ? itemObj.command : JSON.stringify(itemObj);
          entries.push({
            key,
            eventName: key,
            command: cmd,
          });
        }
      }
      return entries;
    }

    if (typeof hooksObj !== 'object' || hooksObj === null) {
      return [];
    }

    const record = hooksObj as Record<string, unknown>;
    for (const [key, val] of Object.entries(record)) {
      if (typeof val === 'string') {
        entries.push({
          key,
          eventName: key,
          command: val,
        });
      } else if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const elem: unknown = val[i];
          const entryKey = `${key}[${i}]`;
          if (typeof elem === 'string') {
            entries.push({
              key: entryKey,
              eventName: key,
              arrayIndex: i,
              command: elem,
            });
          } else if (typeof elem === 'object' && elem !== null && !Array.isArray(elem)) {
            const elemObj = elem as Record<string, unknown>;
            const cmd =
              typeof elemObj.command === 'string' ? elemObj.command : JSON.stringify(elemObj);
            entries.push({
              key: entryKey,
              eventName: key,
              arrayIndex: i,
              command: cmd,
            });
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        const valObj = val as Record<string, unknown>;
        const cmd =
          typeof valObj.command === 'string' ? valObj.command : JSON.stringify(valObj);
        entries.push({
          key,
          eventName: key,
          command: cmd,
        });
      }
    }

    return entries;
  } catch {
    return null;
  }
}

export function detectHookChanged(
  filePath: string,
  baseContent: string | null,
  headContent: string | null
): Finding[] {
  if (headContent === null) {
    return [];
  }

  const headList = parseHooks(headContent);
  if (!headList) {
    return [];
  }

  let baseList: HookEntry[] = [];
  if (baseContent !== null) {
    const parsedBase = parseHooks(baseContent);
    if (!parsedBase) {
      return [];
    }
    baseList = parsedBase;
  }

  // Count max array elements per eventName across base and head to determine
  // whether index disambiguation in the display name is necessary.
  const eventCounts = new Map<string, number>();
  for (const entry of baseList) {
    if (entry.arrayIndex !== undefined) {
      const current = eventCounts.get(entry.eventName) ?? 0;
      eventCounts.set(entry.eventName, Math.max(current, entry.arrayIndex + 1));
    }
  }
  for (const entry of headList) {
    if (entry.arrayIndex !== undefined) {
      const current = eventCounts.get(entry.eventName) ?? 0;
      eventCounts.set(entry.eventName, Math.max(current, entry.arrayIndex + 1));
    }
  }

  const baseMap = new Map<string, HookEntry>();
  for (const entry of baseList) {
    baseMap.set(entry.key, entry);
  }

  const findings: Finding[] = [];

  for (const headEntry of headList) {
    const totalCount = eventCounts.get(headEntry.eventName) ?? 0;
    const displayName =
      headEntry.arrayIndex !== undefined && totalCount > 1
        ? `${headEntry.eventName}[${headEntry.arrayIndex}]`
        : headEntry.eventName;

    const baseEntry = baseMap.get(headEntry.key);
    if (!baseEntry) {
      findings.push({
        detectorId: 'diff-drift.hook-changed',
        severity: 'high',
        file: filePath,
        summary: `New hook '${displayName}' added`,
        detail: `The head branch adds a new hook '${displayName}' with command '${headEntry.command}' to ${filePath}. Injecting or altering hooks is the attack vector behind CVE-2025-59536, which exploits Claude Code's hooks by executing unauthorized commands in .claude/settings.json.`,
      });
    } else if (baseEntry.command !== headEntry.command) {
      findings.push({
        detectorId: 'diff-drift.hook-changed',
        severity: 'high',
        file: filePath,
        summary: `Hook '${displayName}' command changed`,
        detail: `The command for hook '${displayName}' in ${filePath} was modified from '${baseEntry.command}' to '${headEntry.command}'. Injecting or altering hooks is the attack vector behind CVE-2025-59536, which exploits Claude Code's hooks by executing unauthorized commands in .claude/settings.json.`,
      });
    }
  }

  return findings;
}
