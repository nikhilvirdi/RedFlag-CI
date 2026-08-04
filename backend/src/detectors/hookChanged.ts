import { Finding } from '../types';

// Reads the hooks map out of .claude/settings.json. Returns null on
// malformed / non-object JSON (fail-open: the caller reports nothing), and an
// empty Map when the hooks section is absent or empty.
function parseHooks(content: string): Map<string, string> | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const hooksObj = obj.hooks;

    if (hooksObj === undefined) {
      return new Map<string, string>();
    }

    const hooksMap = new Map<string, string>();

    if (Array.isArray(hooksObj)) {
      for (let i = 0; i < hooksObj.length; i++) {
        const item: unknown = hooksObj[i];
        if (typeof item === 'string') {
          hooksMap.set(`hook[${i}]`, item);
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
          hooksMap.set(key, cmd);
        }
      }
      return hooksMap;
    }

    if (typeof hooksObj !== 'object' || hooksObj === null) {
      return new Map<string, string>();
    }

    const record = hooksObj as Record<string, unknown>;
    for (const [key, val] of Object.entries(record)) {
      if (typeof val === 'string') {
        hooksMap.set(key, val);
      } else if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const elem: unknown = val[i];
          const entryKey = val.length === 1 ? key : `${key}[${i}]`;
          if (typeof elem === 'string') {
            hooksMap.set(entryKey, elem);
          } else if (typeof elem === 'object' && elem !== null && !Array.isArray(elem)) {
            const elemObj = elem as Record<string, unknown>;
            const cmd =
              typeof elemObj.command === 'string' ? elemObj.command : JSON.stringify(elemObj);
            hooksMap.set(entryKey, cmd);
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        const valObj = val as Record<string, unknown>;
        const cmd =
          typeof valObj.command === 'string' ? valObj.command : JSON.stringify(valObj);
        hooksMap.set(key, cmd);
      }
    }

    return hooksMap;
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

  const headHooks = parseHooks(headContent);
  if (!headHooks) {
    return [];
  }

  let baseHooks = new Map<string, string>();
  if (baseContent !== null) {
    const parsedBase = parseHooks(baseContent);
    if (!parsedBase) {
      return [];
    }
    baseHooks = parsedBase;
  }

  const findings: Finding[] = [];

  for (const [hookName, headCommand] of headHooks.entries()) {
    if (!baseHooks.has(hookName)) {
      findings.push({
        detectorId: 'diff-drift.hook-changed',
        severity: 'high',
        file: filePath,
        summary: `New hook '${hookName}' added`,
        detail: `The head branch adds a new hook '${hookName}' with command '${headCommand}' to ${filePath}. Injecting or altering hooks is the attack vector behind CVE-2025-59536, which exploits Claude Code's hooks by executing unauthorized commands in .claude/settings.json.`,
      });
    } else {
      const baseCommand = baseHooks.get(hookName);
      if (baseCommand !== headCommand) {
        findings.push({
          detectorId: 'diff-drift.hook-changed',
          severity: 'high',
          file: filePath,
          summary: `Hook '${hookName}' command changed`,
          detail: `The command for hook '${hookName}' in ${filePath} was modified from '${baseCommand}' to '${headCommand}'. Injecting or altering hooks is the attack vector behind CVE-2025-59536, which exploits Claude Code's hooks by executing unauthorized commands in .claude/settings.json.`,
        });
      }
    }
  }

  return findings;
}
