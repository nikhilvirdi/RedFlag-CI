import { getGitHubAppConfig } from './config';

describe('getGitHubAppConfig', () => {
  afterEach(() => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
  });

  it('throws when GITHUB_APP_ID is not set', () => {
    delete process.env.GITHUB_APP_ID;
    process.env.GITHUB_APP_PRIVATE_KEY = 'a-key';

    expect(() => getGitHubAppConfig()).toThrow(
      'GITHUB_APP_ID environment variable is not set'
    );
  });

  it('throws when GITHUB_APP_PRIVATE_KEY is not set', () => {
    process.env.GITHUB_APP_ID = '12345';
    delete process.env.GITHUB_APP_PRIVATE_KEY;

    expect(() => getGitHubAppConfig()).toThrow(
      'GITHUB_APP_PRIVATE_KEY environment variable is not set'
    );
  });

  it('returns the app id and normalizes escaped newlines in the private key', () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY =
      '-----BEGIN RSA PRIVATE KEY-----\\nabc\\n-----END RSA PRIVATE KEY-----';

    const config = getGitHubAppConfig();

    expect(config.appId).toBe('12345');
    expect(config.privateKey).toBe(
      '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----'
    );
  });
});
