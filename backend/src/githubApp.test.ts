import { createGitHubApp, getChangedFiles, GitHubApp } from './githubApp';

// Shaped like a real GitHub `pull_request` webhook event payload.
const mockPullRequestEvent = {
  action: 'opened',
  number: 42,
  pull_request: { number: 42 },
  repository: {
    name: 'octo-repo',
    owner: { login: 'octo-org' },
  },
  installation: { id: 123 },
};

// octokit.paginate() takes the route function itself plus params, calls it
// per page, and hands back the flattened `.data` across every page -- this
// mimics that closely enough for a single-page fixture without needing a
// real paginating Octokit instance.
function mockPaginate() {
  return jest
    .fn()
    .mockImplementation(async (route: (params: unknown) => Promise<{ data: unknown[] }>, params: unknown) => {
      const { data } = await route(params);
      return data;
    });
}

describe('getChangedFiles', () => {
  it('lists the files changed in a mocked pull request event', async () => {
    const listFiles = jest.fn().mockResolvedValue({
      data: [{ filename: '.mcp.json' }, { filename: 'README.md' }],
    });
    const paginate = mockPaginate();
    const getInstallationOctokit = jest.fn().mockResolvedValue({
      rest: { pulls: { listFiles } },
      paginate,
    });
    const app = { getInstallationOctokit } as unknown as GitHubApp;

    const files = await getChangedFiles(app, {
      installationId: mockPullRequestEvent.installation.id,
      owner: mockPullRequestEvent.repository.owner.login,
      repo: mockPullRequestEvent.repository.name,
      pullNumber: mockPullRequestEvent.pull_request.number,
    });

    expect(files).toEqual(['.mcp.json', 'README.md']);
    expect(getInstallationOctokit).toHaveBeenCalledWith(123);
    expect(paginate).toHaveBeenCalledWith(listFiles, {
      owner: 'octo-org',
      repo: 'octo-repo',
      pull_number: 42,
      per_page: 100,
    });
  });

  it('returns an empty list when the pull request has no changed files', async () => {
    const listFiles = jest.fn().mockResolvedValue({ data: [] });
    const getInstallationOctokit = jest.fn().mockResolvedValue({
      rest: { pulls: { listFiles } },
      paginate: mockPaginate(),
    });
    const app = { getInstallationOctokit } as unknown as GitHubApp;

    const files = await getChangedFiles(app, {
      installationId: 123,
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
    });

    expect(files).toEqual([]);
  });

  it('collects files past the first page when the PR touches more than 100 files', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ filename: `file-${i}.json` }));
    const page2 = [{ filename: 'file-100.json' }, { filename: 'file-101.json' }];
    const listFiles = jest.fn();
    const paginate = jest.fn().mockResolvedValue([...page1, ...page2].map((f) => f));
    const getInstallationOctokit = jest.fn().mockResolvedValue({
      rest: { pulls: { listFiles } },
      paginate,
    });
    const app = { getInstallationOctokit } as unknown as GitHubApp;

    const files = await getChangedFiles(app, {
      installationId: 123,
      owner: 'octo-org',
      repo: 'octo-repo',
      pullNumber: 42,
    });

    expect(files).toHaveLength(102);
    expect(files[100]).toBe('file-100.json');
    expect(files[101]).toBe('file-101.json');
  });
});

describe('Task 6.3: throttling plugin is actually wired into the Octokit client', () => {
  afterEach(() => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
  });

  // @octokit/plugin-throttling throws at Octokit-construction time if
  // onRateLimit/onSecondaryRateLimit handlers aren't present in the options
  // -- and @octokit/app's own constructor never forwards a `throttle` option
  // to `new Octokit(...)` on its own. So this only passes if the handlers
  // are actually baked into the Octokit class via .defaults(), which is the
  // audit fix itself: a regression here means the plugin silently stopped
  // being wired in, not just "a test broke."
  it('constructs without throwing, proving the throttling plugin has its required handlers configured', () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY =
      '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----';

    expect(() => createGitHubApp()).not.toThrow();
  });

  it('produces an Octokit instance with the normal REST surface still intact', () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY =
      '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----';

    const app = createGitHubApp();

    expect(typeof app.octokit.rest.pulls.listFiles).toBe('function');
    expect(typeof app.octokit.rest.checks.create).toBe('function');
  });
});
