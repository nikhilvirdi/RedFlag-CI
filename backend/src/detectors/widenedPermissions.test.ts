import * as fs from 'fs';
import * as path from 'path';
import { detectWidenedPermissions } from './widenedPermissions';

describe('DD-3: detectWidenedPermissions', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'dd3');
  const filePath = '.claude/settings.json';

  const readFixture = (name: string, file: 'before.json' | 'after.json'): string =>
    fs.readFileSync(path.join(fixturesDir, name, file), 'utf-8');

  it('fires a warning when an entry is added to the allow-list (fixture)', () => {
    const findings = detectWidenedPermissions(
      filePath,
      readFixture('allow-added', 'before.json'),
      readFixture('allow-added', 'after.json')
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.widened-permissions',
      severity: 'warning',
      file: filePath,
      summary: "Permission 'Read(.env)' added to allow-list",
      detail:
        "The head branch adds 'Read(.env)' to the allow-list in .claude/settings.json. " +
        'This widens what the agent is permitted to do without approval; a broader ' +
        'allow-list means more actions run unprompted.',
    });
  });

  it('fires a warning when a deny rule present in base is removed in head (fixture)', () => {
    const findings = detectWidenedPermissions(
      filePath,
      readFixture('deny-removed', 'before.json'),
      readFixture('deny-removed', 'after.json')
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.widened-permissions',
      severity: 'warning',
      file: filePath,
      summary: "Deny rule 'Bash(rm)' removed",
      detail:
        "The head branch removes the deny rule 'Bash(rm)' from .claude/settings.json. " +
        'Removing a deny rule lifts a restriction that previously blocked the agent from ' +
        'performing that action, widening what it is allowed to do.',
    });
  });

  it('fires a HIGH-severity finding when a wildcard is introduced into the allow-list (fixture)', () => {
    const findings = detectWidenedPermissions(
      filePath,
      readFixture('wildcard-introduced', 'before.json'),
      readFixture('wildcard-introduced', 'after.json')
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.widened-permissions',
      severity: 'high',
      file: filePath,
      summary: "Wildcard permission 'Bash(*)' added to allow-list",
      detail:
        "The head branch adds the wildcard permission 'Bash(*)' to the allow-list in " +
        ".claude/settings.json. A wildcard grants a broad, open-ended class of actions " +
        "rather than a single reviewed one, sharply widening the agent's unprompted " +
        'execution surface.',
    });
  });

  it('keeps a scoped glob pattern at warning, not high, even though it contains "*" (fixture)', () => {
    // Regression coverage for the wildcard-escalation bug found via benchmark
    // stress-testing (dd3-narrowing-syntax-rewrite): a wildcard embedded in a
    // longer, scoped pattern like "Read(src/**)" is a narrow, bounded grant,
    // not the same thing as "Bash(*)" being wide open. Escalating both to the
    // same HIGH severity would manufacture false confidence the detector
    // cannot back up.
    const findings = detectWidenedPermissions(
      filePath,
      readFixture('scoped-glob-wildcard', 'before.json'),
      readFixture('scoped-glob-wildcard', 'after.json')
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.widened-permissions',
      severity: 'warning',
      file: filePath,
      summary: "Permission 'Read(src/**)' added to allow-list",
      detail:
        "The head branch adds 'Read(src/**)' to the allow-list in .claude/settings.json. " +
        'This widens what the agent is permitted to do without approval; a broader ' +
        'allow-list means more actions run unprompted.',
    });
  });

  it('does NOT fire on a narrowing change: allow entry removed and deny rule added (fixture)', () => {
    const findings = detectWidenedPermissions(
      filePath,
      readFixture('narrowing', 'before.json'),
      readFixture('narrowing', 'after.json')
    );

    expect(findings).toHaveLength(0);
  });

  it('does NOT fire when an allow entry is only removed (pure narrowing)', () => {
    const before = JSON.stringify({ permissions: { allow: ['Read(a)', 'Read(b)'], deny: [] } });
    const after = JSON.stringify({ permissions: { allow: ['Read(a)'], deny: [] } });

    expect(detectWidenedPermissions(filePath, before, after)).toHaveLength(0);
  });

  it('does NOT fire when a deny rule is only added (pure narrowing)', () => {
    const before = JSON.stringify({ permissions: { allow: ['Read(a)'], deny: [] } });
    const after = JSON.stringify({ permissions: { allow: ['Read(a)'], deny: ['Bash(rm)'] } });

    expect(detectWidenedPermissions(filePath, before, after)).toHaveLength(0);
  });

  it('does NOT fire when nothing changed', () => {
    const same = JSON.stringify({ permissions: { allow: ['Read(a)'], deny: ['Bash(rm)'] } });

    expect(detectWidenedPermissions(filePath, same, same)).toHaveLength(0);
  });

  it('reports each added allow entry and each removed deny rule as separate findings', () => {
    const before = JSON.stringify({
      permissions: { allow: ['Read(a)'], deny: ['Bash(rm)', 'Bash(curl:*)'] },
    });
    const after = JSON.stringify({
      permissions: { allow: ['Read(a)', 'Read(b)', 'Write(c)'], deny: ['Bash(rm)'] },
    });

    const findings = detectWidenedPermissions(filePath, before, after);

    // 2 added allow entries (Read(b), Write(c)) + 1 removed deny (Bash(curl:*)).
    expect(findings).toHaveLength(3);
    const summaries = findings.map((f) => f.summary);
    expect(summaries).toContain("Permission 'Read(b)' added to allow-list");
    expect(summaries).toContain("Permission 'Write(c)' added to allow-list");
    expect(summaries).toContain("Deny rule 'Bash(curl:*)' removed");
    // None of these carry a wildcard-introduction, so all stay at warning.
    expect(findings.every((f) => f.severity === 'warning')).toBe(true);
  });

  it('keeps deny-removal at warning even when the removed deny rule contained a wildcard', () => {
    // The escalation clause is scoped to wildcard INTRODUCTION in the allow-list;
    // removing a deny rule is the separate condition and stays a warning.
    const before = JSON.stringify({ permissions: { allow: [], deny: ['Bash(*)'] } });
    const after = JSON.stringify({ permissions: { allow: [], deny: [] } });

    const findings = detectWidenedPermissions(filePath, before, after);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].summary).toBe("Deny rule 'Bash(*)' removed");
  });

  it('treats a top-level bare wildcard entry as a wildcard introduction (high)', () => {
    const before = JSON.stringify({ permissions: { allow: ['Read(a)'], deny: [] } });
    const after = JSON.stringify({ permissions: { allow: ['Read(a)', '*'], deny: [] } });

    const findings = detectWidenedPermissions(filePath, before, after);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('high');
    expect(findings[0].summary).toBe("Wildcard permission '*' added to allow-list");
  });

  it('escalates a bare recursive-glob entry ("**") the same as a single "*"', () => {
    // Generalization of the "entire body is wildcard characters" rule: a bare
    // "**" is just as unrestricted as "*", since nothing scopes it.
    const before = JSON.stringify({ permissions: { allow: ['Read(a)'], deny: [] } });
    const after = JSON.stringify({ permissions: { allow: ['Read(a)', '**'], deny: [] } });

    const findings = detectWidenedPermissions(filePath, before, after);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('high');
  });

  it('does not escalate wildcards scoped by an extension or a directory prefix', () => {
    const before = JSON.stringify({ permissions: { allow: [], deny: [] } });
    const after = JSON.stringify({
      permissions: { allow: ['Read(*.log)', 'Bash(npm run *)'], deny: [] },
    });

    const findings = detectWidenedPermissions(filePath, before, after);

    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.severity === 'warning')).toBe(true);
  });

  it('ignores non-string entries in the permission arrays', () => {
    const before = JSON.stringify({ permissions: { allow: ['Read(a)'], deny: [] } });
    const after = JSON.stringify({
      permissions: { allow: ['Read(a)', 42, null, { x: 1 }], deny: [] },
    });

    expect(detectWidenedPermissions(filePath, before, after)).toHaveLength(0);
  });

  it('treats an absent permissions block as empty (no findings)', () => {
    const before = JSON.stringify({ hooks: {} });
    const after = JSON.stringify({ hooks: {}, other: true });

    expect(detectWidenedPermissions(filePath, before, after)).toHaveLength(0);
  });

  it('returns zero findings when base is null (newly added file)', () => {
    const after = JSON.stringify({ permissions: { allow: ['Bash(*)'], deny: [] } });

    expect(detectWidenedPermissions(filePath, null, after)).toHaveLength(0);
  });

  it('returns zero findings when head is null (file deleted)', () => {
    const before = JSON.stringify({ permissions: { allow: ['Bash(*)'], deny: [] } });

    expect(detectWidenedPermissions(filePath, before, null)).toHaveLength(0);
  });

  it('fails open (zero findings) when base content is malformed JSON', () => {
    const after = JSON.stringify({ permissions: { allow: ['Bash(*)'], deny: [] } });

    expect(detectWidenedPermissions(filePath, '{ malformed', after)).toHaveLength(0);
  });

  it('fails open (zero findings) when head content is malformed JSON', () => {
    const before = JSON.stringify({ permissions: { allow: [], deny: [] } });

    expect(detectWidenedPermissions(filePath, before, '{ malformed')).toHaveLength(0);
  });

  it('fails open (zero findings) when content is a valid JSON primitive or array', () => {
    const valid = JSON.stringify({ permissions: { allow: ['Read(a)'], deny: [] } });
    expect(detectWidenedPermissions(filePath, valid, '[1, 2, 3]')).toHaveLength(0);
    expect(detectWidenedPermissions(filePath, '"hello"', valid)).toHaveLength(0);
    expect(detectWidenedPermissions(filePath, valid, '123')).toHaveLength(0);
  });
});
