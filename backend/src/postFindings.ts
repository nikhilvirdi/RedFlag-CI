import { Octokit } from '@octokit/rest';
import { Finding } from './types';
import { formatFindingsComment } from './formatFindingsComment';

export interface PostFindingsRequest {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  findings: Finding[];
}

// architecture.md section 6: a comment posts only when there's at least one
// finding; the check run conclusion is "neutral" (findings present) or
// "success" (none) and is never "failure" — RedFlag CI never blocks a PR.
export async function postFindings(octokit: Octokit, request: PostFindingsRequest): Promise<void> {
  const { owner, repo, pullNumber, headSha, findings } = request;
  const hasFindings = findings.length > 0;

  if (hasFindings) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body: formatFindingsComment(findings),
    });
  }

  await octokit.rest.checks.create({
    owner,
    repo,
    name: 'RedFlag CI',
    head_sha: headSha,
    status: 'completed',
    conclusion: hasFindings ? 'neutral' : 'success',
  });
}
