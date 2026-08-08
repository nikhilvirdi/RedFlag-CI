import { GitHubApp } from './githubApp';
import { updateBaselineOnMerge } from './baselineUpdate';
import { DIFF_DRIFT_FILES } from './monitoredFiles';
import { logger } from './logger';

jest.mock('./logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
const mockLogger = logger as unknown as { warn: jest.Mock };

beforeEach(() => {
  mockLogger.warn.mockReset();
});

const OWNER = 'octo-org';
const REPO = 'octo-repo';
const MERGE_SHA = 'merge-commit-sha';
const INSTALLATION_ID = 42;

function notFoundError(): Error & { status: number } {
  return Object.assign(new Error('Not Found'), { status: 404 });
}

function fileResponse(content: string) {
  return {
    data: { type: 'file', content: Buffer.from(content).toString('base64'), encoding: 'base64', sha: 'sha' },
  };
}

function mockGitHubApp(fileContents: Record<string, string>) {
  // getContent is called for two different purposes here: fetching each
  // monitored file at the merge commit (ref === MERGE_SHA), and, inside
  // writeBaseline itself, checking whether baseline.json already exists on
  // the baseline branch (path === 'baseline.json', a different ref
  // entirely) -- always absent in these tests, so writeBaseline creates it.
  const getContent = jest.fn().mockImplementation(({ path, ref }: { path: string; ref: string }) => {
    if (path === 'baseline.json') {
      return Promise.reject(notFoundError());
    }
    expect(ref).toBe(MERGE_SHA);
    const content = fileContents[path];
    return content === undefined ? Promise.reject(notFoundError()) : Promise.resolve(fileResponse(content));
  });
  const getRef = jest.fn().mockResolvedValue({ data: { object: { sha: 'branch-sha' } } });
  const createRef = jest.fn().mockResolvedValue({});
  const getRepo = jest.fn().mockResolvedValue({ data: { default_branch: 'main' } });
  const createOrUpdateFileContents = jest.fn().mockResolvedValue({});
  const getBranch = jest.fn().mockResolvedValue({ data: { protected: true } });

  const octokit = {
    rest: {
      repos: { getContent, get: getRepo, createOrUpdateFileContents, getBranch },
      git: { getRef, createRef },
    },
  };

  const githubApp = {
    getInstallationOctokit: jest.fn().mockResolvedValue(octokit),
  } as unknown as GitHubApp;

  return { githubApp, getContent, createOrUpdateFileContents, getBranch };
}

describe('updateBaselineOnMerge', () => {
  it('fetches every monitored diff-drift file at the merge commit and writes a snapshot covering all of them', async () => {
    const fileContents: Record<string, string> = {
      '.mcp.json': '{"mcpServers":{"weather":{"command":"node"}}}',
      '.claude/settings.json': '{"permissions":{"allow":["Read(*)"]}}',
    };
    const { githubApp, getContent, createOrUpdateFileContents } = mockGitHubApp(fileContents);

    await updateBaselineOnMerge(githubApp, {
      owner: OWNER,
      repo: REPO,
      mergeCommitSha: MERGE_SHA,
      installationId: INSTALLATION_ID,
    });

    // Every possible diff-drift path is checked, not just the ones present
    // (plus one more call: writeBaseline's own check for baseline.json).
    expect(getContent).toHaveBeenCalledTimes(DIFF_DRIFT_FILES.length + 1);
    for (const path of DIFF_DRIFT_FILES) {
      expect(getContent).toHaveBeenCalledWith(expect.objectContaining({ path, ref: MERGE_SHA }));
    }

    expect(createOrUpdateFileContents).toHaveBeenCalledTimes(1);
    const call = createOrUpdateFileContents.mock.calls[0][0];
    // Task A.5: the written content is { snapshot, contentHash }, not a bare snapshot.
    const written = JSON.parse(Buffer.from(call.content, 'base64').toString('utf-8'));
    expect(written.snapshot.files).toEqual(fileContents);
  });

  it('omits a monitored path from the snapshot when it does not exist in the repo (404)', async () => {
    const { githubApp, createOrUpdateFileContents } = mockGitHubApp({});

    await updateBaselineOnMerge(githubApp, {
      owner: OWNER,
      repo: REPO,
      mergeCommitSha: MERGE_SHA,
      installationId: INSTALLATION_ID,
    });

    const call = createOrUpdateFileContents.mock.calls[0][0];
    const written = JSON.parse(Buffer.from(call.content, 'base64').toString('utf-8'));
    expect(written.snapshot.files).toEqual({});
  });

  it('uses the merge commit SHA, not a branch name, as the ref for every file fetch', async () => {
    const { githubApp, getContent } = mockGitHubApp({ '.mcp.json': '{}' });

    await updateBaselineOnMerge(githubApp, {
      owner: OWNER,
      repo: REPO,
      mergeCommitSha: MERGE_SHA,
      installationId: INSTALLATION_ID,
    });

    const fileFetchCalls = getContent.mock.calls.filter((call) => call[0].path !== 'baseline.json');
    expect(fileFetchCalls.length).toBe(DIFF_DRIFT_FILES.length);
    for (const call of fileFetchCalls) {
      expect(call[0].ref).toBe(MERGE_SHA);
    }
  });

  it('checks baseline branch protection after writing, and warns if it is not enabled (Task A.4)', async () => {
    const { githubApp, getBranch } = mockGitHubApp({ '.mcp.json': '{}' });
    getBranch.mockResolvedValue({ data: { protected: false } });

    await updateBaselineOnMerge(githubApp, {
      owner: OWNER,
      repo: REPO,
      mergeCommitSha: MERGE_SHA,
      installationId: INSTALLATION_ID,
    });

    expect(getBranch).toHaveBeenCalledWith({
      owner: OWNER,
      repo: REPO,
      branch: 'redflag-ci/baseline',
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Baseline branch has no branch protection enabled',
      expect.objectContaining({ owner: OWNER, repo: REPO })
    );
  });

  it('does not warn when the baseline branch is protected', async () => {
    const { githubApp } = mockGitHubApp({ '.mcp.json': '{}' });

    await updateBaselineOnMerge(githubApp, {
      owner: OWNER,
      repo: REPO,
      mergeCommitSha: MERGE_SHA,
      installationId: INSTALLATION_ID,
    });

    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
