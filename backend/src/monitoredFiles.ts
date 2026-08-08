export type MonitoredEngine = 'diff-drift' | 'rule-file';

export interface MonitoredFileMatch {
  path: string;
  engine: MonitoredEngine;
}

export interface MonitoredFilesResult {
  hasMatches: boolean;
  matches: MonitoredFileMatch[];
}

// Exported for baseline.ts's merge-triggered snapshot build (Task A.2): the
// baseline needs the full, current list of diff-drift file paths to capture
// on every merge, not just whichever ones a given PR happened to touch.
export const DIFF_DRIFT_FILES: readonly string[] = [
  '.mcp.json',
  '.cursor/mcp.json',
  'claude_desktop_config.json',
  '.claude/settings.json',
];

const RULE_FILE_EXACT_FILES: readonly string[] = ['CLAUDE.md', '.github/copilot-instructions.md'];

const RULE_FILE_DIRECTORIES: readonly string[] = ['.cursor/rules/'];

function matchEngine(path: string): MonitoredEngine | undefined {
  if (DIFF_DRIFT_FILES.includes(path)) {
    return 'diff-drift';
  }

  if (
    RULE_FILE_EXACT_FILES.includes(path) ||
    RULE_FILE_DIRECTORIES.some((dir) => path.startsWith(dir))
  ) {
    return 'rule-file';
  }

  return undefined;
}

export function filterMonitoredFiles(changedFiles: string[]): MonitoredFilesResult {
  const matches: MonitoredFileMatch[] = [];

  for (const path of changedFiles) {
    const engine = matchEngine(path);
    if (engine) {
      matches.push({ path, engine });
    }
  }

  return { hasMatches: matches.length > 0, matches };
}
