export function getWebhookSecret(): string {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('GITHUB_WEBHOOK_SECRET environment variable is not set');
  }

  return secret;
}

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
}

export function getGitHubAppConfig(): GitHubAppConfig {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId) {
    throw new Error('GITHUB_APP_ID environment variable is not set');
  }

  if (!privateKey) {
    throw new Error('GITHUB_APP_PRIVATE_KEY environment variable is not set');
  }

  return {
    appId,
    // PEM keys stored in env vars commonly arrive with literal "\n" instead of real newlines.
    privateKey: privateKey.replace(/\\n/g, '\n'),
  };
}
