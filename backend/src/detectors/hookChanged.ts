import { Finding } from '../types';
import { normalizeUnicode } from '../unicodeNormalize';

interface HookEntry {
  key: string;
  eventName: string;
  arrayIndex?: number;
  command: string;
  matcher?: string;
}

// Purely cosmetic formatting changes (an extra space, trailing whitespace)
// carry no semantic difference in what a hook actually runs, so both sides
// of the command comparison are normalized before comparing; the raw values
// are still what gets shown in the finding text.
function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
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
          const matcher = typeof itemObj.matcher === 'string' ? itemObj.matcher : undefined;
          entries.push({
            key,
            eventName: key,
            command: cmd,
            matcher,
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
            const matcher = typeof elemObj.matcher === 'string' ? elemObj.matcher : undefined;
            entries.push({
              key: entryKey,
              eventName: key,
              arrayIndex: i,
              command: cmd,
              matcher,
            });
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        const valObj = val as Record<string, unknown>;
        const cmd =
          typeof valObj.command === 'string' ? valObj.command : JSON.stringify(valObj);
        const matcher = typeof valObj.matcher === 'string' ? valObj.matcher : undefined;
        entries.push({
          key,
          eventName: key,
          command: cmd,
          matcher,
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
  // whether index disambiguation in the display name is necessary. Keyed by
  // normalized eventName (Task 5.8) so the same event expressed in two
  // Unicode normalization forms between base and head aggregates into one
  // count instead of two independent ones.
  const eventCounts = new Map<string, number>();
  for (const entry of baseList) {
    if (entry.arrayIndex !== undefined) {
      const key = normalizeUnicode(entry.eventName);
      const current = eventCounts.get(key) ?? 0;
      eventCounts.set(key, Math.max(current, entry.arrayIndex + 1));
    }
  }
  for (const entry of headList) {
    if (entry.arrayIndex !== undefined) {
      const key = normalizeUnicode(entry.eventName);
      const current = eventCounts.get(key) ?? 0;
      eventCounts.set(key, Math.max(current, entry.arrayIndex + 1));
    }
  }

  // Keyed by normalized key (Task 5.8): a hook key expressed in a different
  // Unicode normalization form between base and head must still be found as
  // "the same hook" rather than reading as a brand-new one with nothing to
  // diff against.
  const baseMap = new Map<string, HookEntry>();
  for (const entry of baseList) {
    baseMap.set(normalizeUnicode(entry.key), entry);
  }

  const findings: Finding[] = [];

  for (const headEntry of headList) {
    const totalCount = eventCounts.get(normalizeUnicode(headEntry.eventName)) ?? 0;
    const displayName =
      headEntry.arrayIndex !== undefined && totalCount > 1
        ? `${headEntry.eventName}[${headEntry.arrayIndex}]`
        : headEntry.eventName;

    const baseEntry = baseMap.get(normalizeUnicode(headEntry.key));
    if (!baseEntry) {
      findings.push({
        detectorId: 'diff-drift.hook-changed',
        severity: 'high',
        file: filePath,
        summary: `New hook '${displayName}' added`,
        detail: `The head branch adds a new hook '${displayName}' with command '${headEntry.command}' to ${filePath}. Injecting or altering hooks is the attack vector behind CVE-2025-59536, which exploits Claude Code's hooks by executing unauthorized commands in .claude/settings.json.`,
      });
    } else {
      const commandChanged =
        normalizeUnicode(normalizeWhitespace(baseEntry.command)) !==
        normalizeUnicode(normalizeWhitespace(headEntry.command));
      // Unicode-normalized (Task 5.8) before comparing; undefined passes
      // through unchanged rather than being coerced into a string.
      const matcherChanged =
        (baseEntry.matcher === undefined ? undefined : normalizeUnicode(baseEntry.matcher)) !==
        (headEntry.matcher === undefined ? undefined : normalizeUnicode(headEntry.matcher));

      if (commandChanged && matcherChanged) {
        findings.push({
          detectorId: 'diff-drift.hook-changed',
          severity: 'high',
          file: filePath,
          summary: `Hook '${displayName}' command and matcher changed`,
          detail: `The command for hook '${displayName}' in ${filePath} was modified from '${baseEntry.command}' to '${headEntry.command}', and its matcher was modified from '${baseEntry.matcher ?? '(none)'}' to '${headEntry.matcher ?? '(none)'}'. Injecting or altering hooks, or broadening what they apply to, is the attack vector behind CVE-2025-59536, which exploits Claude Code's hooks by executing unauthorized commands in .claude/settings.json.`,
        });
      } else if (commandChanged) {
        findings.push({
          detectorId: 'diff-drift.hook-changed',
          severity: 'high',
          file: filePath,
          summary: `Hook '${displayName}' command changed`,
          detail: `The command for hook '${displayName}' in ${filePath} was modified from '${baseEntry.command}' to '${headEntry.command}'. Injecting or altering hooks is the attack vector behind CVE-2025-59536, which exploits Claude Code's hooks by executing unauthorized commands in .claude/settings.json.`,
        });
      } else if (matcherChanged) {
        findings.push({
          detectorId: 'diff-drift.hook-changed',
          severity: 'high',
          file: filePath,
          summary: `Hook '${displayName}' matcher changed`,
          detail: `The matcher for hook '${displayName}' in ${filePath} was modified from '${baseEntry.matcher ?? '(none)'}' to '${headEntry.matcher ?? '(none)'}'. Broadening what a hook applies to widens its effective reach even when the command itself is unchanged, independent of the command-injection vector behind CVE-2025-59536 that this detector also watches for in .claude/settings.json.`,
        });
      }
    }
  }

  return findings;
}
