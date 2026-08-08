import { Octokit } from '@octokit/rest';
import { Finding } from './types';
import { formatFindingsComment, formatCumulativeDriftSection } from './formatFindingsComment';

export interface PostFindingsRequest {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  findings: Finding[];
  // Task A.6: findings from comparing against the stored baseline (Task
  // A.3) that this PR's own base/head diff wouldn't show on its own.
  // Optional and defaulted to empty so every existing caller/test that
  // never had a baseline to compare against needs no changes.
  cumulativeFindings?: Finding[];
}

const CHECK_RUN_NAME = 'RedFlag CI';

// Stable marker embedded in every comment RedFlag CI posts, so a later run
// on the same PR (a `synchronize` push) can find its own prior comment and
// edit it instead of piling up a new one per push.
const COMMENT_MARKER = '<!-- redflag-ci -->';

async function findExistingCommentId(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<number | null> {
  // ponytail: single page (100 comments), no pagination loop. Upgrade to
  // paginate() if a PR ever collects >100 comments before RedFlag CI's first.
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100,
  });
  const existing = comments.find((comment) => comment.body?.includes(COMMENT_MARKER));
  return existing?.id ?? null;
}

// GitHub's Checks API has no upsert semantics: POST /check-runs always
// creates a brand-new check run, even when one already exists with the same
// name for the same SHA (confirmed against the Octokit REST types — `create`
// is POST /check-runs, `update` is a separate PATCH by check_run_id). So,
// same as the comment, we look for a prior run before deciding create vs.
// update.
async function findExistingCheckRunId(
  octokit: Octokit,
  owner: string,
  repo: string,
  headSha: string
): Promise<number | null> {
  const { data } = await octokit.rest.checks.listForRef({
    owner,
    repo,
    ref: headSha,
    check_name: CHECK_RUN_NAME,
  });
  return data.check_runs[0]?.id ?? null;
}

// architecture.md section 6: a comment posts only when there's at least one
// finding; the check run conclusion is "neutral" (findings present) or
// "success" (none) and is never "failure" — RedFlag CI never blocks a PR.
// Task A.6: cumulativeFindings counts toward that decision exactly like
// findings does -- drift that's only visible against the baseline is still
// a real finding, not a lesser one, so it still flips the check to neutral
// and still posts a comment even if this PR's own diff alone found nothing.
export async function postFindings(octokit: Octokit, request: PostFindingsRequest): Promise<void> {
  const { owner, repo, pullNumber, headSha, findings, cumulativeFindings = [] } = request;
  const hasFindings = findings.length > 0 || cumulativeFindings.length > 0;

  if (hasFindings) {
    const sections = [formatFindingsComment(findings), formatCumulativeDriftSection(cumulativeFindings)].filter(
      Boolean
    );
    const body = `${sections.join('\n\n')}\n\n${COMMENT_MARKER}`;
    const existingCommentId = await findExistingCommentId(octokit, owner, repo, pullNumber);

    if (existingCommentId !== null) {
      await octokit.rest.issues.updateComment({ owner, repo, comment_id: existingCommentId, body });
    } else {
      await octokit.rest.issues.createComment({ owner, repo, issue_number: pullNumber, body });
    }
  }

  const conclusion = hasFindings ? 'neutral' : 'success';
  const existingCheckRunId = await findExistingCheckRunId(octokit, owner, repo, headSha);

  if (existingCheckRunId !== null) {
    await octokit.rest.checks.update({
      owner,
      repo,
      check_run_id: existingCheckRunId,
      status: 'completed',
      conclusion,
    });
  } else {
    await octokit.rest.checks.create({
      owner,
      repo,
      name: CHECK_RUN_NAME,
      head_sha: headSha,
      status: 'completed',
      conclusion,
    });
  }
}
