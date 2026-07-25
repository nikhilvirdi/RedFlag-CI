import { getChangedFiles, GitHubApp } from './githubApp';

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

describe('getChangedFiles', () => {
  it('lists the files changed in a mocked pull request event', async () => {
    const listFiles = jest.fn().mockResolvedValue({
      data: [{ filename: '.mcp.json' }, { filename: 'README.md' }],
    });
    const getInstallationOctokit = jest.fn().mockResolvedValue({
      rest: { pulls: { listFiles } },
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
    expect(listFiles).toHaveBeenCalledWith({
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
});
