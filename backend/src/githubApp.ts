import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { getGitHubAppConfig } from './config';

export type GitHubApp = App<{ Octokit: typeof Octokit }>;

export function createGitHubApp(): GitHubApp {
  const { appId, privateKey } = getGitHubAppConfig();
  return new App({ appId, privateKey, Octokit });
}

export interface ChangedFilesRequest {
  installationId: number;
  owner: string;
  repo: string;
  pullNumber: number;
}

export async function getChangedFiles(
  app: GitHubApp,
  request: ChangedFilesRequest
): Promise<string[]> {
  const { installationId, owner, repo, pullNumber } = request;
  const octokit = await app.getInstallationOctokit(installationId);

  const { data } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  return data.map((file) => file.filename);
}
