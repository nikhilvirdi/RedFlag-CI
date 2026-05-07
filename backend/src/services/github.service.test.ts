import {
    getInstallationOctokit,
    postPullRequestComment,
    setCommitStatus,
} from './github.service';

jest.mock('@octokit/app', () => ({
    App: jest.fn().mockImplementation(() => ({
        getInstallationOctokit: jest.fn().mockResolvedValue({
            rest: {
                issues: {
                    createComment: jest.fn().mockResolvedValue({ data: { id: 1 } }),
                },
                repos: {
                    createCommitStatus: jest.fn().mockResolvedValue({ data: {} }),
                },
            },
        }),
    })),
}));

jest.mock('../config/env', () => ({
    env: {
        GITHUB_APP_ID: '12345',
        GITHUB_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
        GITHUB_WEBHOOK_SECRET: 'webhook-secret',
        GITHUB_CLIENT_ID: 'client-id',
        GITHUB_CLIENT_SECRET: 'client-secret',
        ANTHROPIC_API_KEY: 'key',
        OPENAI_API_KEY: 'key',
        JWT_SECRET: 'jwt',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        DATABASE_URL: 'postgresql://test',
        PORT: '3000',
        NODE_ENV: 'test',
    },
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('github.service', () => {
    describe('getInstallationOctokit', () => {
        it('returns an octokit instance for a valid installationId', async () => {
            const octokit = await getInstallationOctokit(12345);
            expect(octokit).toBeDefined();
            expect(octokit.rest).toBeDefined();
        });
    });

    describe('setCommitStatus', () => {
        it('calls createCommitStatus with correct state', async () => {
            const octokit = await getInstallationOctokit(12345);
            await setCommitStatus(octokit, 'org', 'repo', 'sha123', 'pending', 'Scanning...');
            expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(expect.objectContaining({
                owner: 'org',
                repo: 'repo',
                sha: 'sha123',
                state: 'pending',
            }));
        });
    });

    describe('postPullRequestComment', () => {
        it('calls createComment with the correct body', async () => {
            const octokit = await getInstallationOctokit(12345);
            await postPullRequestComment(octokit, 'org', 'repo', 1, '## Report\nAll clear.');
            expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(expect.objectContaining({
                owner: 'org',
                repo: 'repo',
                issue_number: 1,
                body: '## Report\nAll clear.',
            }));
        });
    });
});
