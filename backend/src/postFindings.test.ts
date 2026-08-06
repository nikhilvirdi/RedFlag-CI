import { Octokit } from '@octokit/rest';
import { Finding } from './types';
import { postFindings } from './postFindings';

const sampleFindings: Finding[] = [
  {
    detectorId: 'diff-drift.hook-changed',
    severity: 'high',
    file: '.claude/settings.json',
    summary: "New hook 'PostToolUse' added",
    detail:
      "The head branch adds a new hook 'PostToolUse' with command './scripts/notify.sh' to " +
      ".claude/settings.json. Injecting or altering hooks is the attack vector behind " +
      "CVE-2025-59536, which exploits Claude Code's hooks by executing unauthorized commands " +
      'in .claude/settings.json.',
  },
];

function mockOctokit(overrides: {
  createComment?: jest.Mock;
  createCheck?: jest.Mock;
}): Octokit {
  const createComment = overrides.createComment ?? jest.fn().mockResolvedValue({});
  const createCheck = overrides.createCheck ?? jest.fn().mockResolvedValue({});

  return {
    rest: {
      issues: { createComment },
      checks: { create: createCheck },
    },
  } as unknown as Octokit;
}

describe('Task 5.3: postFindings', () => {
  it('posts exactly one comment and creates a neutral check run when findings are present', async () => {
    const createComment = jest.fn().mockResolvedValue({});
    const createCheck = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ createComment, createCheck });

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'abc123',
      findings: sampleFindings,
    });

    expect(createComment).toHaveBeenCalledTimes(1);
    expect(createComment).toHaveBeenCalledWith({
      owner: 'octo-org',
      repo: 'octo-repo',
      issue_number: 42,
      body: expect.stringContaining("New hook 'PostToolUse' added"),
    });

    expect(createCheck).toHaveBeenCalledTimes(1);
    expect(createCheck).toHaveBeenCalledWith({
      owner: 'octo-org',
      repo: 'octo-repo',
      name: 'RedFlag CI',
      head_sha: 'abc123',
      status: 'completed',
      conclusion: 'neutral',
    });
  });

  it('creates only a success check run and posts no comment when there are no findings', async () => {
    const createComment = jest.fn().mockResolvedValue({});
    const createCheck = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ createComment, createCheck });

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'abc123',
      findings: [],
    });

    expect(createComment).not.toHaveBeenCalled();

    expect(createCheck).toHaveBeenCalledTimes(1);
    expect(createCheck).toHaveBeenCalledWith({
      owner: 'octo-org',
      repo: 'octo-repo',
      name: 'RedFlag CI',
      head_sha: 'abc123',
      status: 'completed',
      conclusion: 'success',
    });
  });

  it('never sets the check run conclusion to "failure", regardless of finding severity', async () => {
    const createCheck = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ createCheck });

    const highSeverityOnly: Finding[] = sampleFindings.map((f) => ({ ...f, severity: 'high' }));
    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'abc123',
      findings: highSeverityOnly,
    });

    const [call] = createCheck.mock.calls;
    expect(call[0].conclusion).not.toBe('failure');
    expect(['neutral', 'success']).toContain(call[0].conclusion);
  });
});
