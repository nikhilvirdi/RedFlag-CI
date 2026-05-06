import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger';

let githubApp: App | null = null;

function getGithubApp(): App {
    if (githubApp) return githubApp;

    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
        throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set in .env to use the GitHub service.');
    }

    githubApp = new App({
        appId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        webhooks: {
            secret: process.env.GITHUB_WEBHOOK_SECRET || '',
        },
    });

    return githubApp;
}

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
    const app = getGithubApp();
    const octokit = await app.getInstallationOctokit(installationId);
    return octokit as unknown as Octokit;
}

export async function getPullRequestDiff(
    octokit: Octokit,
    owner: string,
    repo: string,
    pullRequestNumber: number
): Promise<string> {
    logger.info(`Fetching diff for ${owner}/${repo}#${pullRequestNumber}`);

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
        issue_number: pullRequestNumber,
        body,
    });
}

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
        context: 'RedFlag CI / Security Scan',
    });
}

export async function getFileContent(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
    ref: string
): Promise<string> {
    logger.info(`Fetching file content: ${path} at ${ref}`);
    const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path,
        ref,
    });
    
    if (Array.isArray(response.data) || !('content' in response.data) || !response.data.content) {
        throw new Error(`File ${path} is not a single readable file`);
    }

    return Buffer.from(response.data.content, 'base64').toString('utf8');
}

export async function createBranch(
    octokit: Octokit,
    owner: string,
    repo: string,
    branchName: string,
    sha: string
): Promise<void> {
    logger.info(`Creating branch ${branchName} from ${sha}`);
    await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha,
    });
}

export async function createBlob(
    octokit: Octokit,
    owner: string,
    repo: string,
    content: string
): Promise<string> {
    const response = await octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
        owner,
        repo,
        content,
        encoding: 'utf-8',
    });
    return response.data.sha;
}

export async function createTree(
    octokit: Octokit,
    owner: string,
    repo: string,
    baseTreeSha: string,
    tree: Array<{
        path: string;
        mode: '100644' | '100755' | '040000' | '160000' | '120000';
        type: 'blob' | 'tree' | 'commit';
        sha: string;
    }>
): Promise<string> {
    const response = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
        owner,
        repo,
        base_tree: baseTreeSha,
        tree,
    });
    return response.data.sha;
}

export async function createCommit(
    octokit: Octokit,
    owner: string,
    repo: string,
    message: string,
    treeSha: string,
    parentShas: string[]
): Promise<string> {
    const response = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
        owner,
        repo,
        message,
        tree: treeSha,
        parents: parentShas,
    });
    return response.data.sha;
}

export async function updateRef(
    octokit: Octokit,
    owner: string,
    repo: string,
    ref: string,
    sha: string
): Promise<void> {
    logger.info(`Updating ref ${ref} to ${sha}`);
    await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
        owner,
        repo,
        ref,
        sha,
        force: true,
    });
}

export async function createPullRequest(
    octokit: Octokit,
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body: string
): Promise<{ html_url: string; number: number }> {
    logger.info(`Opening Pull Request: ${head} -> ${base}`);
    const response = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner,
        repo,
        title,
        head,
        base,
        body,
    });
    return {
        html_url: response.data.html_url,
        number: response.data.number,
    };
}

export async function getRepositoryContext(owner: string, repo: string) {
    const app = getGithubApp();
    const { data: installation } = await app.octokit.request('GET /repos/{owner}/{repo}/installation', {
        owner,
        repo,
    });
    
    const octokit = await getInstallationOctokit(installation.id);
    const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
    });

    const { data: branch } = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
        owner,
        repo,
        branch: repository.default_branch,
    });

    return {
        installationId: installation.id,
        defaultBranch: repository.default_branch,
        headSha: branch.commit.sha,
    };
}

export async function getCommitDiff(
    octokit: Octokit,
    owner: string,
    repo: string,
    sha: string
): Promise<string> {
    logger.info(`Fetching diff for ${owner}/${repo}@${sha}`);

    const response = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
        owner,
        repo,
        ref: sha,
        headers: {
            accept: 'application/vnd.github.v3.diff',
        },
    });

    return response.data as unknown as string;
}
