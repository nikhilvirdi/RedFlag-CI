# RedFlag CI: Architecture

This is the complete reference for RedFlag CI: what it is, how it's built, why every major decision was made, and what each of the four planned versions actually contains. If something in `workplan.md` seems to contradict this file, this file wins; `workplan.md` should be updated to match.

## 1. What RedFlag CI is

A GitHub App that scans pull requests for risky changes to AI agent configuration, specifically the files that control what an AI coding agent is allowed to do and what instructions it follows. It comments on a PR only when it finds something worth flagging. The background and market research behind this scope live in `docs/PROBLEM_SPACE.md` and `docs/COMPETITIVE_LANDSCAPE.md`; this document covers the system itself.

## 2. Design principles

These aren't just preferences. Each one is a direct response to a specific failure mode found during research, and each is a constraint later phases have to respect.

**Deterministic-only in v1.** No LLM calls, no ML models, no semantic reasoning. Every detector is a plain function operating on file contents and diffs. This is what makes the tool's output predictable and its false-positive rate close to zero, which matters more than catching everything, given that the single biggest complaint about every competing tool is noise.

**Precision over recall.** RedFlag CI will miss cleverly obfuscated attacks that don't rely on invisible characters or an obvious permission change. That's an accepted tradeoff, not an oversight. A tool developers trust because it's quiet is more valuable than one that's thorough but gets muted after a week.

**Fail-open.** A malformed or unparseable config file never blocks a PR. The affected check reports neutral, and RedFlag CI moves on. Security tools that break builds on files they can't parse train people to disable them.

**Least privilege.** The GitHub App requests only the permissions it needs: `contents:read`, `pull_requests:write`, `checks:write`. Nothing broader, regardless of what a future version might eventually want.

**Zero-config, quiet by default.** Install it, and it works. No dashboard, no settings screen, no required setup. Silence on an unaffected PR is itself part of the product.

**Stateless in v1.** No database. The "baseline" for drift detection is just the PR's base branch, fetched fresh through GitHub's API on every run. This is possible only because v1 is deterministic; a persistence layer becomes necessary starting in v3, once history and trend tracking are in scope.

**Additive versions, no breaking changes.** Every version from v2 onward adds a capability without altering v1's default behavior. Nothing is ever forced on by an upgrade. See section 7 for the full versioning strategy.

## 3. System architecture (v1)

```
Pull request opened or updated
        |
        v
GitHub webhook -> RedFlag CI service
        |
        v
Verify webhook signature
        |
        v
Does the diff touch a monitored file? --- no --> stop, no comment, check passes
        |
       yes
        v
Fetch base-branch and head-branch versions of each touched monitored file
        |
        v
Run the relevant detector(s) against the before/after pair
        |
        v
Aggregate findings
        |
        v
Any findings? --- no --> post a passing check, no comment
        |
       yes
        v
Post one PR comment describing each finding
Post a neutral check run (informational, never blocking)
```

The whole thing is one Express service. No queue, no worker process, no scheduled jobs. A webhook triggers a synchronous handler that finishes in well under a second, since the entire operation is a handful of small file fetches and pure-function checks.

## 4. Monitored files

**Diff-drift engine watches:**
- `.mcp.json`
- `.cursor/mcp.json`
- `claude_desktop_config.json`
- `.claude/settings.json` (permissions and hooks)

**Rule-file engine watches:**
- `CLAUDE.md`
- `.cursor/rules/*` (any file under this directory)
- `.github/copilot-instructions.md`

A PR that doesn't touch any file in either list produces no output at all.

## 5. Detector specifications (v1)

Every detector has the same shape: it receives a before-state and an after-state of a file (the after-state is absent for the rule-file engine, since those checks don't need a diff) and returns zero or more findings.

```typescript
interface Finding {
  detectorId: string;       // e.g. "diff-drift.new-mcp-server"
  severity: "info" | "warning" | "high";
  file: string;             // repo-relative path
  summary: string;          // one-line description for the PR comment
  detail: string;           // longer explanation, includes a CVE reference where one applies
}
```

### Diff-drift engine

**DD-1: New MCP server added.** Compares the set of server entries between base and head. Any entry present in head but absent from base is a finding. Severity: `warning`.

**DD-2: Pinned tool or version swapped.** For a server entry present in both base and head, compares the command, arguments, and any pinned version or hash. A change to any of these on an existing entry is a finding. This is the MCPoison pattern: a trusted, already-approved tool silently repointed to something else. Severity: `high`.

**DD-3: Permission or allow-list widened.** Compares the permissions and allow-list arrays in `.claude/settings.json`. A finding fires when the head version adds entries not present in base, removes a deny rule present in base, or introduces a wildcard where none existed. Severity: `warning`, escalated to `high` if a wildcard is introduced.

**DD-4: Hook added or changed.** Compares the hooks section of `.claude/settings.json`. A new hook, or a change to an existing hook's command, is a finding. This is the vector behind CVE-2025-59536. Severity: `high`.

### Rule-file engine

**RF-1: Invisible Unicode.** Scans file contents for zero-width spaces, zero-width joiners, and bidirectional-override characters. Any match is a finding, since there's no legitimate reason for these characters to appear in a markdown instruction file. Severity: `high`.

**RF-2: Homoglyph characters.** Scans for Cyrillic and Greek characters that are visually identical to Latin ones (for example, a Cyrillic "а" standing in for a Latin "a"). Severity: `high`.

Both rule-file detectors are pure character-class checks. No natural-language interpretation, no judgment calls, which is why they carry a near-zero false-positive rate.

## 6. Output

**PR comment**, posted only if there's at least one finding, one comment per PR run (not one per finding), formatted as a short list: what changed, in which file, and why it matters, with a CVE reference where one applies.

**Check run status**: `success` (no findings, or the diff didn't touch a monitored file) or `neutral` (findings present). RedFlag CI never fails a check. Blocking a merge is a decision for the repository's own branch protection rules, not something this tool imposes by default.

## 7. Tech stack

Fixed to the maintainer's existing stack, since v1's scope needs nothing exotic:

- **Node.js + Express + TypeScript**, strict mode
- **@octokit/app** and **@octokit/rest** for GitHub App authentication and API calls
- **Zod** for validating webhook payloads
- **Jest + Supertest** for testing; every detector is a pure function, so each gets a direct unit test plus fixture files
- **Winston** for logging, **Morgan** for request logging
- **Docker** for packaging, **GitHub Actions** for CI

Deliberately not used in v1, despite being in the maintainer's broader toolkit: PostgreSQL/Prisma, Redis, MongoDB, Socket.io, GraphQL. None of them are needed until later versions (see section 8), and adding them now would just be unused surface area.

## 8. Versioning roadmap

Full detail on the versioning convention, branching model, and release process lives in the project's release strategy notes. This section covers what each version actually contains.

### v1 [ACTIVE]: dual deterministic engine

The complete scope of sections 3 through 7. Ships as a stateless service with no persistence layer.

### v2 [LOCKED]: opt-in LLM adjudication tier

Adds a second-tier pipeline: v1's deterministic detectors still run first and still catch everything they catch today. A new, separate tier can escalate genuinely ambiguous findings to an LLM for adjudication, using a key the user supplies themselves. This tier is off unless explicitly enabled; v1's default behavior doesn't change. The point isn't to replace precision with a slower, fuzzier check; it's to catch the subset of attacks that don't rely on invisible characters or an obvious permission change, without reintroducing the noise problem v1 was built to avoid. Exact architecture (which findings qualify as "ambiguous," how the escalation is triggered, prompt design) is finalized when this version becomes active, informed by what v1's real-world usage actually looks like.

### v3 [LOCKED]: persistence and broader coverage

Adds a Postgres layer (via Prisma, already in the maintainer's stack) to store finding history and support a simple trend view: has this repo's agent-config risk gone up or down over time. Also broadens file coverage to configs introduced by newer tools as they appear (Windsurf and similar). This is the first version that needs a database, which is why it isn't in v1: nothing before this point requires state.

### v4 [LOCKED]: platform features

Adds MCP server behavioral and semantic scanning (a different problem from the static checks in v1, closer to what tools like mcp-scan already do), auto-suggested fix PRs for the subset of findings that have an obvious correction, SARIF export for teams that want to feed results into existing security tooling, and an optional dashboard. All additive; the core PR-comment flow from v1 is untouched.

**Deprecation policy:** since every version from v2 onward is additive and opt-in, there's no forced-migration path to manage. Nothing added in a later version changes what an earlier version already does by default.

## 9. Explicit non-goals (v1)

- No whole-repository indexing or cross-file taint analysis. Established during research to be technically unreliable at PR-diff scope; see `docs/PROBLEM_SPACE.md`.
- No hallucinated-package or slopsquatting detection. Already well covered by existing tools (Socket.dev, Aikido SafeChain); adding it here would duplicate, not differentiate.
- No auto-fix. Deferred to v4, once the detector set is proven and a "safe automatic correction" can be scoped properly.
- No dashboard or UI of any kind in v1.