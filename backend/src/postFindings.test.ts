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
  updateComment?: jest.Mock;
  listComments?: jest.Mock;
  createCheck?: jest.Mock;
  updateCheck?: jest.Mock;
  listForRef?: jest.Mock;
}): Octokit {
  const createComment = overrides.createComment ?? jest.fn().mockResolvedValue({});
  const updateComment = overrides.updateComment ?? jest.fn().mockResolvedValue({});
  const listComments = overrides.listComments ?? jest.fn().mockResolvedValue({ data: [] });
  const createCheck = overrides.createCheck ?? jest.fn().mockResolvedValue({});
  const updateCheck = overrides.updateCheck ?? jest.fn().mockResolvedValue({});
  const listForRef = overrides.listForRef ?? jest.fn().mockResolvedValue({ data: { check_runs: [] } });

  return {
    rest: {
      issues: { createComment, updateComment, listComments },
      checks: { create: createCheck, update: updateCheck, listForRef },
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

// Stateful fake standing in for GitHub's actual comment/check-run store, so
// the two-event scenario below exercises the same list-then-create-or-update
// path postFindings uses against the real API instead of a mock that always
// reports "nothing exists yet".
function statefulOctokit(): Octokit {
  const comments: { id: number; body: string }[] = [];
  const checkRuns: { id: number; head_sha: string; conclusion: string }[] = [];
  let nextId = 1;

  const listComments = jest.fn().mockImplementation(async () => ({ data: comments }));
  const createComment = jest.fn().mockImplementation(async ({ body }: { body: string }) => {
    const comment = { id: nextId++, body };
    comments.push(comment);
    return { data: comment };
  });
  const updateComment = jest
    .fn()
    .mockImplementation(async ({ comment_id, body }: { comment_id: number; body: string }) => {
      const comment = comments.find((c) => c.id === comment_id)!;
      comment.body = body;
      return { data: comment };
    });

  const listForRef = jest.fn().mockImplementation(async ({ ref }: { ref: string }) => ({
    data: { check_runs: checkRuns.filter((run) => run.head_sha === ref) },
  }));
  const createCheck = jest
    .fn()
    .mockImplementation(async ({ head_sha, conclusion }: { head_sha: string; conclusion: string }) => {
      const run = { id: nextId++, head_sha, conclusion };
      checkRuns.push(run);
      return { data: run };
    });
  const updateCheck = jest
    .fn()
    .mockImplementation(async ({ check_run_id, conclusion }: { check_run_id: number; conclusion: string }) => {
      const run = checkRuns.find((r) => r.id === check_run_id)!;
      run.conclusion = conclusion;
      return { data: run };
    });

  return {
    rest: {
      issues: { createComment, updateComment, listComments },
      checks: { create: createCheck, update: updateCheck, listForRef },
    },
  } as unknown as Octokit;
}

describe('Task 6.1: comment/check-run idempotency on synchronize events', () => {
  it('edits the existing comment in place on a second synchronize event, instead of duplicating it', async () => {
    const octokit = statefulOctokit();
    const firstFindings = sampleFindings;
    const secondFindings: Finding[] = [
      {
        detectorId: 'diff-drift.new-mcp-server',
        severity: 'high',
        file: '.mcp.json',
        summary: "New MCP server 'evil-server' added",
        detail: 'The head branch adds a new, previously unseen MCP server.',
      },
    ];

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'sha-1',
      findings: firstFindings,
    });
    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'sha-1',
      findings: secondFindings,
    });

    const { listComments, createComment, updateComment } = octokit.rest.issues as unknown as {
      listComments: jest.Mock;
      createComment: jest.Mock;
      updateComment: jest.Mock;
    };
    const finalComments = (await listComments.mock.results.at(-1)!.value).data as { body: string }[];

    expect(createComment).toHaveBeenCalledTimes(1);
    expect(updateComment).toHaveBeenCalledTimes(1);
    expect(finalComments).toHaveLength(1);
    expect(finalComments[0].body).toContain("New MCP server 'evil-server' added");
    expect(finalComments[0].body).not.toContain("New hook 'PostToolUse' added");
  });

  it('updates the existing check run in place on a second synchronize event, instead of duplicating it', async () => {
    const octokit = statefulOctokit();

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'sha-1',
      findings: sampleFindings,
    });
    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'sha-1',
      findings: sampleFindings,
    });

    const { listForRef, create, update } = octokit.rest.checks as unknown as {
      listForRef: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    const finalRuns = (await listForRef.mock.results.at(-1)!.value).data.check_runs;

    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(finalRuns).toHaveLength(1);
  });

  it('creates a new comment (not an edit) when no prior RedFlag CI comment exists on the PR', async () => {
    const octokit = statefulOctokit();

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'sha-1',
      findings: sampleFindings,
    });

    const { createComment, updateComment } = octokit.rest.issues as unknown as {
      createComment: jest.Mock;
      updateComment: jest.Mock;
    };
    expect(createComment).toHaveBeenCalledTimes(1);
    expect(updateComment).not.toHaveBeenCalled();
  });

  it('edits a prior findings comment to a resolved-state message when a later push has zero findings', async () => {
    const octokit = statefulOctokit();

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'sha-1',
      findings: sampleFindings,
    });
    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'sha-1',
      findings: [],
    });

    const { createComment, updateComment, listComments } = octokit.rest.issues as unknown as {
      createComment: jest.Mock;
      updateComment: jest.Mock;
      listComments: jest.Mock;
    };
    const finalComments = (await listComments.mock.results.at(-1)!.value).data as { body: string }[];

    // Edited in place, not replaced with a second comment.
    expect(createComment).toHaveBeenCalledTimes(1);
    expect(updateComment).toHaveBeenCalledTimes(1);
    expect(finalComments).toHaveLength(1);
    expect(finalComments[0].body).toContain(
      'RedFlag CI: previously flagged issues have been resolved.'
    );
    expect(finalComments[0].body).toContain('No findings on the latest push.');
    // The stale finding must actually be gone, not just appended to.
    expect(finalComments[0].body).not.toContain("New hook 'PostToolUse' added");
    expect(finalComments[0].body).not.toContain('RedFlag CI found');

    const { create: createCheck, update: updateCheck, listForRef } = octokit.rest.checks as unknown as {
      create: jest.Mock;
      update: jest.Mock;
      listForRef: jest.Mock;
    };
    const finalRuns = (await listForRef.mock.results.at(-1)!.value).data.check_runs as {
      conclusion: string;
    }[];

    expect(finalRuns).toHaveLength(1);
    expect(finalRuns[0].conclusion).toBe('success');
    expect(createCheck).toHaveBeenCalledTimes(1);
    expect(updateCheck).toHaveBeenCalledTimes(1);
  });

  it('only matches a comment carrying the RedFlag CI marker, ignoring unrelated comments on the PR', async () => {
    const listComments = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 99, body: 'looks great, thanks!' }] });
    const createComment = jest.fn().mockResolvedValue({});
    const updateComment = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ listComments, createComment, updateComment });

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'abc123',
      findings: sampleFindings,
    });

    expect(createComment).toHaveBeenCalledTimes(1);
    expect(updateComment).not.toHaveBeenCalled();
  });
});

describe('Task A.6: cumulativeFindings render as a distinct comment section', () => {
  const cumulativeFinding: Finding = {
    detectorId: 'diff-drift.widened-permissions',
    severity: 'warning',
    file: '.claude/settings.json',
    summary: "Permission 'Bash(git diff)' added to allow-list",
    detail: "The head branch adds 'Bash(git diff)' to the allow-list in .claude/settings.json.",
  };

  it('includes both sections in the comment body when both findings and cumulativeFindings are present', async () => {
    const createComment = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ createComment });

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'abc123',
      findings: sampleFindings,
      cumulativeFindings: [cumulativeFinding],
    });

    const body = createComment.mock.calls[0][0].body as string;
    expect(body).toContain("New hook 'PostToolUse' added");
    expect(body).toContain("Permission 'Bash(git diff)' added to allow-list");
    expect(body).toContain('additional change found since the last known-good baseline');
  });

  it('still posts a comment (and a neutral check) when findings is empty but cumulativeFindings is not', async () => {
    const createComment = jest.fn().mockResolvedValue({});
    const createCheck = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ createComment, createCheck });

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'abc123',
      findings: [],
      cumulativeFindings: [cumulativeFinding],
    });

    expect(createComment).toHaveBeenCalledTimes(1);
    const body = createComment.mock.calls[0][0].body as string;
    expect(body).toContain("Permission 'Bash(git diff)' added to allow-list");
    expect(body).not.toContain('RedFlag CI found'); // no main-section header when findings is empty
    expect(createCheck).toHaveBeenCalledWith(expect.objectContaining({ conclusion: 'neutral' }));
  });

  it('creates a success check and posts no comment when both findings and cumulativeFindings are empty', async () => {
    const createComment = jest.fn().mockResolvedValue({});
    const createCheck = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ createComment, createCheck });

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'abc123',
      findings: [],
      cumulativeFindings: [],
    });

    expect(createComment).not.toHaveBeenCalled();
    expect(createCheck).toHaveBeenCalledWith(expect.objectContaining({ conclusion: 'success' }));
  });

  it('behaves exactly as before when cumulativeFindings is simply omitted (backward compatible)', async () => {
    const createComment = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ createComment });

    await postFindings(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
      headSha: 'abc123',
      findings: sampleFindings,
    });

    const body = createComment.mock.calls[0][0].body as string;
    expect(body).not.toContain('additional change');
  });
});
