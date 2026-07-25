# RedFlag CI: Workplan

Structured as Version → Phase → Task. A task is the smallest unit of work and should be completed in a single agent session, with its own acceptance criterion. A phase is a group of tasks that together reach one milestone. A version is a full release.

**This project has four planned versions. Build only what's marked `[ACTIVE]`.** Do not begin, scaffold, or reference code for a `[LOCKED]` version unless the user has explicitly declared it active. Full reasoning behind every decision referenced here lives in `architecture.md`.

---

## Version 1 [ACTIVE]: Dual deterministic engine

### Phase 0: Project scaffolding

- **Task 0.1**: Initialize the repo skeleton (`backend/`, `package.json`, `tsconfig.json` in strict mode, ESLint + Prettier config). Acceptance: `npm run lint` and `npm run build` both succeed on an empty project.
- **Task 0.2**: Set up Jest + Supertest. Acceptance: a single placeholder test runs and passes via `npm test`.
- **Task 0.3**: Add a `Dockerfile` and GitHub Actions CI workflow (lint, test, build on every push). Acceptance: CI passes on a push containing only the scaffolding from 0.1 and 0.2.

### Phase 1: GitHub App skeleton

- **Task 1.1**: Express server with a single webhook endpoint, GitHub signature verification via the app's webhook secret. Acceptance: a request with a valid signature returns 200; an invalid one returns 401, both covered by a test.
- **Task 1.2**: Octokit integration to authenticate as the GitHub App and fetch a PR's changed files. Acceptance: given a mocked PR event, the handler correctly lists which files changed.
- **Task 1.3**: Filter changed files against the monitored-file list from `architecture.md` section 4. Acceptance: a test PR touching only unrelated files results in no further processing; a PR touching `.mcp.json` proceeds.

### Phase 2: File fetching

- **Task 2.1**: Fetch the base-branch and head-branch versions of a given file path via the GitHub API. Acceptance: given a real or mocked repo, returns both versions correctly, and returns `null` for the base version when a file is newly added.

### Phase 3: Diff-drift detectors

- **Task 3.1**: Implement DD-1 (new MCP server added) as a pure function, with before/after fixture files. Acceptance: fixture with an added server produces exactly one finding; fixture with no change produces none.
- **Task 3.2**: Implement DD-2 (pinned tool/version swapped). Acceptance: fixture representing the MCPoison pattern (same server name, changed command) produces a `high`-severity finding.
- **Task 3.3**: Implement DD-3 (permission/allow-list widened). Acceptance: fixtures cover three cases: entry added, deny rule removed, wildcard introduced. All three produce findings; a narrowing change does not.
- **Task 3.4**: Implement DD-4 (hook added or changed). Acceptance: fixture with a new hook and one with a modified existing hook both produce findings.

### Phase 4: Rule-file detectors

- **Task 4.1**: Implement RF-1 (invisible Unicode). Acceptance: fixture containing a zero-width space and one containing a bidirectional override both produce findings; a clean file produces none.
- **Task 4.2**: Implement RF-2 (homoglyph detection). Acceptance: fixture with a Cyrillic look-alike character produces a finding; a file using only standard Latin characters does not.

### Phase 5: Aggregation and output

- **Task 5.1**: Aggregate findings from all detectors run against a single PR into one ordered list. Acceptance: given findings from multiple detectors, output is a single combined list, sorted by severity.
- **Task 5.2**: Format the aggregated findings into a single PR comment body. Acceptance: a snapshot test confirms the comment text matches the expected format for a given findings list.
- **Task 5.3**: Post the comment and a check run (`success` or `neutral`, per section 6 of `architecture.md`) via Octokit. Acceptance: given a mocked PR with findings, exactly one comment and one check run are created; given no findings, only the check run.

### Phase 6: End-to-end validation

- **Task 6.1**: Wire Phases 1 through 5 together into a full webhook-to-comment flow, tested against a set of realistic fixture PRs covering each detector at least once.
- **Task 6.2**: Package as an installable GitHub App (manifest, permission scopes per `architecture.md` section 2's least-privilege principle) and install on a private test repository.

### Phase 7: Evidence and documentation

- **Task 7.1**: Build a small benchmark corpus, 15 to 20 synthetic PR diffs covering both malicious and benign agent-config changes, and run RedFlag CI against it. Record precision and recall.
- **Task 7.2**: Write an ADR documenting the deterministic-only, precision-over-recall decision, referencing the benchmark results.
- **Task 7.3**: Run the same benchmark corpus against a comparable existing tool (AgentShield or mcp-scan) and record the result for a direct comparison in the README.

**v1 is complete when Phase 7 is done and the benchmark results are documented.**

---

## Version 2 [LOCKED]: Opt-in LLM adjudication tier

Not yet broken into phases. When this version becomes active, the first task is to revisit `architecture.md` section 8's v2 entry in light of what v1's actual usage surfaced, then derive phases the same way v1's were derived: scaffolding, the escalation trigger, the adjudication call itself, output integration, evidence.

## Version 3 [LOCKED]: Persistence and broader coverage

Not yet broken into phases. Starts with introducing the Postgres/Prisma layer, then finding-history storage, then the trend view, then expanded file-type coverage.

## Version 4 [LOCKED]: Platform features

Not yet broken into phases. Covers MCP behavioral scanning, auto-fix suggestions, SARIF export, and the dashboard, roughly in that order, since each has independent value and none blocks the others.