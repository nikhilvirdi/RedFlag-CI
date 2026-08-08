import { Octokit } from '@octokit/rest';
import { GitHubApp } from './githubApp';

export interface FileVersionsRequest {
  installationId: number;
  owner: string;
  repo: string;
  path: string;
  baseRef: string;
  headRef: string;
}

export interface FileVersions {
  base: string | null;
  head: string | null;
}

export async function getFileVersions(
  app: GitHubApp,
  request: FileVersionsRequest
): Promise<FileVersions> {
  const { installationId, owner, repo, path, baseRef, headRef } = request;
  const octokit = await app.getInstallationOctokit(installationId);

  const [base, head] = await Promise.all([
    fetchFileContent(octokit, owner, repo, path, baseRef),
    fetchFileContent(octokit, owner, repo, path, headRef),
  ]);

  return { base, head };
}

export interface FileAtRefRequest {
  installationId: number;
  owner: string;
  repo: string;
  path: string;
  ref: string;
}

// Task A.2: a single-ref fetch for the baseline's merge-triggered snapshot
// build, which needs one file's content at the merge commit, not a
// base/head pair. Reuses fetchFileContent's own 404-as-null handling rather
// than duplicating it.
export async function getFileAtRef(app: GitHubApp, request: FileAtRefRequest): Promise<string | null> {
  const { installationId, owner, repo, path, ref } = request;
  const octokit = await app.getInstallationOctokit(installationId);
  return fetchFileContent(octokit, owner, repo, path, ref);
}

async function fetchFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });

    // The contents API also returns an array (directory listing) or a
    // symlink/submodule entry; only a plain file has decodable content.
    if (Array.isArray(data) || data.type !== 'file') {
      return null;
    }

    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 404
  );
}
