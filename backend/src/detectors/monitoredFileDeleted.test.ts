import * as fs from 'fs';
import * as path from 'path';
import { detectMonitoredFileDeleted } from './monitoredFileDeleted';

describe('DD-8: detectMonitoredFileDeleted', () => {
  const filePath = '.claude/settings.json';

  // Only a before.json fixture exists for this detector -- there is
  // deliberately no after.json, since the scenario under test IS the file's
  // absence in head, not any particular (empty) content for it.
  const before = fs.readFileSync(
    path.join(__dirname, '__fixtures__', 'dd8', 'settings-deleted', 'before.json'),
    'utf-8'
  );

  it('fires a HIGH-severity finding when a monitored file present in base is absent in head (fixture)', () => {
    const findings = detectMonitoredFileDeleted(filePath, before, null);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      detectorId: 'diff-drift.monitored-file-deleted',
      severity: 'high',
      file: filePath,
      summary: "Monitored file '.claude/settings.json' was deleted",
      detail:
        'The head branch deletes .claude/settings.json, which previously defined MCP server, ' +
        'permission, and/or hook configuration. Deleting the file removes every constraint it ' +
        'defined in a single change, and every detector that compares against head content has ' +
        'nothing left to scan against -- this is flagged separately because the deletion itself, ' +
        'not any specific entry inside the file, is the risk.',
    });
  });

  it('does NOT fire when base is null (file never existed, nothing deleted)', () => {
    expect(detectMonitoredFileDeleted(filePath, null, null)).toHaveLength(0);
  });

  it('does NOT fire when head is present (not a deletion)', () => {
    expect(detectMonitoredFileDeleted(filePath, before, before)).toHaveLength(0);
  });

  it('does NOT fire when the file is newly added (base null, head present)', () => {
    expect(detectMonitoredFileDeleted(filePath, null, before)).toHaveLength(0);
  });
});
