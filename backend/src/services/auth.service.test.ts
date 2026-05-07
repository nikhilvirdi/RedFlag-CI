import { buildGitHubAuthUrl } from './auth.service';

jest.mock('../config/db', () => ({
    prisma: {
        user: { upsert: jest.fn() },
    },
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../config/env', () => ({
    env: {
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CALLBACK_URL: 'http://localhost:3000/api/auth/callback',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-secret',
        JWT_SECRET: 'test-jwt-secret',
    },
}));

describe('auth.service', () => {
    describe('buildGitHubAuthUrl', () => {
        it('returns a url containing the client_id and a 32-char hex state', () => {
            const { url, state } = buildGitHubAuthUrl();

            expect(url).toContain('https://github.com/login/oauth/authorize');
            expect(url).toContain('client_id=test-client-id');
            expect(state).toMatch(/^[a-f0-9]{32}$/);
        });

        it('generates unique state on each call', () => {
            const first = buildGitHubAuthUrl();
            const second = buildGitHubAuthUrl();

            expect(first.state).not.toEqual(second.state);
        });

        it('includes the redirect_uri in the url', () => {
            const { url } = buildGitHubAuthUrl();

            expect(url).toContain(encodeURIComponent('http://localhost:3000/api/auth/callback'));
        });
    });
});
