import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger';

// GITHUB APP AUTHENTICATION
// GitHub Apps authenticate in two stages:
//   Stage 1 — App-level JWT: Signed with the App's RSA private key, valid for 10 min.
//             Used only to generate Installation Tokens.
//   Stage 2 — Installation Token: A scoped, short-lived OAuth-like token granting
//             the App permissions on a specific user/org's repositories.
//
// @octokit/app wraps both stages automatically. We initialize it once here and
// call getInstallationOctokit() per request to get a correctly scoped client.

let githubApp: App | null = null;

function getGithubApp(): App {
    // Lazy singleton — only instantiate once, reuse across all requests.
    if (githubApp) return githubApp;

    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
        throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set in .env to use the GitHub service.');
    }

    githubApp = new App({
        appId,
        // Private key in .env is stored with literal \n — replace to real newlines.
        privateKey: privateKey.replace(/\\n/g, '\n'),
        webhooks: {
            // webhooks secret is handled separately in the middleware, not here.
            secret: process.env.GITHUB_WEBHOOK_SECRET || '',
        },
    });

    return githubApp;
}

// GET INSTALLATION OCTOKIT
// Returns an Octokit instance authenticated with a fresh Installation Token
// scoped to the specific repository that triggered the webhook.
// Each installation (user/org that installed our App) has a unique installationId.
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
    const app = getGithubApp();
    // @octokit/app internally generates the JWT, exchanges it for an installation
    // token, and injects the token as a Bearer header on all subsequent requests.
    const octokit = await app.getInstallationOctokit(installationId);
    return octokit as unknown as Octokit;
}

// GET PULL REQUEST DIFF
// Downloads the raw unified diff (patch format) for a specific PR.
// The diff contains exactly the lines added/removed — this is what the scan engine will analyze.
export async function getPullRequestDiff(
    octokit: Octokit,
    owner: string,
    repo: string,
    pullRequestNumber: number
): Promise<string> {
    logger.info(`Fetching diff for ${owner}/${repo}#${pullRequestNumber}`);

    // GitHub returns the diff when Accept header is set to 'application/vnd.github.v3.diff'
    const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner,
        repo,
        pull_number: pullRequestNumber,
        headers: {
            accept: 'application/vnd.github.v3.diff',
        },
    });

    return response.data as unknown as string;
}

// POST PR REVIEW COMMENT
// Posts a top-level summary comment on the Pull Request with the scan results.
// This is what the developer actually sees in their GitHub PR interface.
export async function postPullRequestComment(
    octokit: Octokit,
    owner: string,
    repo: string,
    pullRequestNumber: number,
    body: string
): Promise<void> {
    logger.info(`Posting review comment on ${owner}/${repo}#${pullRequestNumber}`);

    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner,
        repo,
        // GitHub treats PRs as Issues for the purposes of comments.
        issue_number: pullRequestNumber,
        body,
    });
}

// SET COMMIT STATUS
// Updates the GitHub "check" icon (green tick / red cross) on a commit.
// This is what blocks or allows merging in protected branch workflows.
export async function setCommitStatus(
    octokit: Octokit,
    owner: string,
    repo: string,
    sha: string,
    state: 'pending' | 'success' | 'failure' | 'error',
    description: string
): Promise<void> {
    logger.info(`Setting commit status [${state}] on ${sha.slice(0, 7)} in ${owner}/${repo}`);

    await octokit.request('POST /repos/{owner}/{repo}/statuses/{sha}', {
        owner,
        repo,
        sha,
        state,
        description,
        context: 'RedFlag CI / Security Scan', // Label shown in the GitHub PR UI
    });
}
