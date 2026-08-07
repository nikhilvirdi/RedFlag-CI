# RedFlag CI: Architecture

This is the complete reference for RedFlag CI: what it is, how it's built, why every major decision was made, and what each planned version through v2 (the project's final version) actually contains. If something in `workplan.md` seems to contradict this file, this file wins; `workplan.md` should be updated to match.

## 1. What RedFlag CI is

A GitHub App that scans pull requests for risky changes to AI agent configuration, specifically the files that control what an AI coding agent is allowed to do and what instructions it follows. It comments on a PR only when it finds something worth flagging. The background and market research behind this scope live in `docs/PROBLEM_SPACE.md` and `docs/COMPETITIVE_LANDSCAPE.md`; this document covers the system itself.

## 2. Design principles

These aren't just preferences. Each one is a direct response to a specific failure mode found during research, and each is a constraint later phases have to respect.

**Deterministic-only in v1.** No LLM calls, no ML models, no semantic reasoning. Every detector is a plain function operating on file contents and diffs. This is what makes the tool's output predictable and its false-positive rate close to zero, which matters more than catching everything, given that the single biggest complaint about every competing tool is noise.

**Precision over recall.** RedFlag CI will miss cleverly obfuscated attacks that don't rely on invisible characters or an obvious permission change. That's an accepted tradeoff, not an oversight. A tool developers trust because it's quiet is more valuable than one that's thorough but gets muted after a week.

**Fail-open.** A malformed or unparseable config file never blocks a PR. The affected check reports neutral, and RedFlag CI moves on. Security tools that break builds on files they can't parse train people to disable them.

**Least privilege.** The GitHub App requests only the permissions it needs: `contents:read`, `pull_requests:write`, `checks:write`. Nothing broader, regardless of what a future version might eventually want.

**Zero-config, quiet by default.** Install it, and it works. No dashboard, no settings screen, no required setup. Silence on an unaffected PR is itself part of the product.

**Stateless in v1 and v1.2.0.** No database. The "baseline" for drift detection is just the PR's base branch, fetched fresh through GitHub's API on every run. v2 adds the one piece of cross-PR memory this design needs, but does it with a git-native snapshot rather than a database -- see section 8.

**Additive versions, no breaking changes.** Every version from v1.2.0 onward adds a capability without altering v1's default behavior. Nothing is ever forced on by an upgrade. See section 8 for the full versioning strategy.

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

**DD-2: Pinned tool or version swapped.** For a server entry present in both base and head, compares the command, arguments, any pinned version or hash, and any environment variables. A change to any of these on an existing entry is a finding, since an env-var swap (for example, redirecting a server to a different endpoint) is functionally the same MCPoison-shaped risk as a command or argument swap. This is the MCPoison pattern: a trusted, already-approved tool silently repointed to something else. Severity: `high`.

**DD-3: Permission or allow-list widened.** Compares the permissions and allow-list arrays in `.claude/settings.json`. A finding fires when the head version adds entries not present in base, removes a deny rule present in base, or introduces a wildcard where none existed. Severity: `warning`, escalated to `high` if a wildcard is introduced.

**DD-4: Hook added or changed.** Compares the hooks section of `.claude/settings.json`. A new hook, a change to an existing hook's command, or a change to its matcher/trigger scope, is a finding, since broadening what a hook applies to (for example, from "Bash" to "*") is a real widening of the hook's effective reach independent of whether the command itself changed. This is the vector behind CVE-2025-59536. Severity: `high`.

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

Deliberately not used in v1, despite being in the maintainer's broader toolkit: PostgreSQL/Prisma, Redis, MongoDB, Socket.io, GraphQL. None of them are needed at any point in this project's roadmap (see section 8) -- v2's cross-PR memory is handled with a git-native snapshot, not a database -- so adding any of them would just be unused surface area.

## 8. Versioning roadmap

Full detail on the versioning convention, branching model, and release process lives in the project's release strategy notes. This section covers what each version actually contains.

This roadmap is closed. v2 is the final planned release. No version beyond it exists, and none will be added; when v2 ships and its results are documented, this project is complete.

### v1.1.0 [SHIPPED]: dual deterministic engine

The complete scope of sections 3 through 7. Ships as a stateless service with no persistence layer. Hardened once already post-launch: the benchmark corpus grew from 18 to 120 scenarios across six rounds of stress-testing, surfacing one real detector defect (fixed) and five further precision/recall gaps (all fixed). See `CHANGELOG.md` and `docs/STRESS_TESTING.md`.

### v1.2.0 [ACTIVE]: detector hardening and pipeline correctness

A second hardening pass, still fully within v1's deterministic design, no new capability tier. Covers three kinds of work:

- **Detection fixes**, closing gaps the 120-scenario benchmark documented as known limitations rather than defects: RF-2 adopts Unicode's official confusables table in place of the hand-picked one; RF-1's character ranges expand to cover combining diacriticals and the Unicode Tags block; DD-1 and DD-3 gain shared remove/add correlation logic so a rename or a narrowing no longer reads as a brand-new, unreviewed entry; DD-2's argument comparison becomes order-insensitive for flagged (non-positional) arguments; DD-1's `mcpServers`/`servers` dual-key handling is fixed to merge rather than short-circuit.
- **New deterministic detectors**, closing gaps that were simply out of scope before: unpinned MCP dependency versions, obfuscated commands (base64 blobs, shell piping), homoglyphs and invisible-Unicode in JSON config keys as well as markdown rule files, duplicate top-level JSON keys, suspicious network targets (bare IPs, non-HTTPS URLs), path traversal in args/env, a local-to-remote MCP transport-type change, and project-wide Unicode normalization before any string comparison.
- **Pipeline correctness**, independent of detection logic: PR comment and check-run idempotency on `synchronize` events (edit the existing comment instead of posting a new one on every push, so the tool stays quiet the way its own design principles require), webhook delivery deduplication via the `X-GitHub-Delivery` header, and an audit confirming Octokit's rate-limit/throttling handling is actually wired in, so a rate-limit failure can't be silently absorbed by the fail-open policy and reported as "clean."

The benchmark corpus expands again in this version, incorporating real-world-sourced scenarios where they can be found, in addition to continued deliberate stress-testing. The exact final scenario count is determined during this version's development, not fixed in advance; what matters is coverage, not a target number.

### v2 [FINAL PLANNED VERSION]: cross-PR drift memory and interoperable output

The last version. Two phases:

**Phase A: cross-PR drift memory.** v1 and v1.2.0 are both fully stateless: every check compares a PR's base branch to its head branch, with no memory of anything outside that single diff. The benchmark's own stress-testing documented the resulting blind spot directly: two small, individually unremarkable permission widenings across two separate pull requests each look fine on their own, because nothing tracks a pattern across PRs. Phase A closes this without introducing a database: a small JSON baseline snapshot is committed to a dedicated branch in the repo, updated only when a PR actually merges (never speculatively, on PR-open), so it can't be poisoned by an unmerged change. Detection compares the current PR against this stored baseline in addition to its base branch, tracking cumulative widening across a rolling window of merges rather than only pairwise PR-to-PR comparison. The baseline branch itself is protected and its snapshot carries an integrity hash, so the "known good" state can't be silently rewritten; when the drift check fires, the PR comment shows what changed since the baseline, not just that something did.

**Phase B: SARIF and JSON export.** Not a new detector, just a different, machine-readable serialization of findings the tool already produces. SARIF output lets a team upload results to GitHub's native Security tab via a standard GitHub Actions step, so RedFlag CI gets dashboard-equivalent visibility for teams that want it without this project ever hosting or building one. A plain JSON export covers teams whose tooling doesn't consume SARIF. An optional, opt-in CI exit-code threshold lets a team choose to fail their own build on `high`-severity findings if they want that -- configured on the consuming side, and it does not change RedFlag CI's own check run, which remains `success`/`neutral` and never fails a check by default.

v2's benchmark corpus grows further to cover cross-PR scenarios (a shape the 120-scenario corpus and v1.2.0's expansion don't test, since both are single-PR by construction) and the new export formats. As with v1.2.0, the exact scenario count is finalized during development, not decided up front.

### What was scoped and explicitly rejected, not deferred

An earlier draft of this roadmap planned four major versions: v2 as an opt-in LLM adjudication tier, v3 as Postgres-backed persistence and broader file coverage, and v4 as MCP behavioral scanning, auto-fix PRs, SARIF export, and a dashboard. After scrutiny, most of that was cut, not postponed:

- **LLM adjudication tier and a custom-trained ML model (both considered, both rejected).** Either would abandon the deterministic, zero-noise design this entire project is built around, and would duplicate ground already claimed by funded, cloud-based semantic scanners (Invariant Guardrails, MCP-Guard) rather than defending RedFlag CI's actual differentiator. Nearly every concrete gap this tier was meant to close (the uncommon-homoglyph miss, the legitimate-multilingual-text false positive) turned out to have a deterministic fix instead -- see v1.2.0 above.
- **Full Postgres persistence and a trend dashboard.** Cut for the same reason: v1 explicitly names "no dashboard" as a design principle, so a database backing trend data nobody's UI displays is pure unused surface area, and it breaks the zero-config, install-and-it-works promise the whole project is positioned on. The one genuinely real gap this was meant to close -- cross-PR drift -- survives, but is solved the lightweight way in v2's Phase A instead, with no database and no hosting requirement.
- **MCP server behavioral/semantic scanning.** Cut. This requires actually running MCP servers to observe their behavior, which is both a real safety risk (see `backend/benchmark/COMPARISON.md`'s discussion of why this comparison declined to execute untrusted servers) and already well-covered ground (mcp-scan, AgentShield), per `docs/COMPETITIVE_LANDSCAPE.md`.
- **Auto-fix PRs.** Cut. Auto-generating code changes is a different trust model than flagging a risk (act vs. inform), a materially larger liability surface, and crowded, funded territory (CodeRabbit, Greptile) RedFlag CI was never trying to compete on.
- **SARIF export survives, narrowed.** Of the original v4 scope, only this earns its place, and it moves into v2 Phase B rather than staying a hypothetical fourth tier, since it's an output format on top of existing findings, not new detection logic or new infrastructure.

**Deprecation policy:** every version from v1.2.0 onward is additive; nothing added in a later version changes what an earlier version already does by default. v1.2.0's new detectors run by default (they're the same category as v1's existing ones). v2's cross-PR memory and export options are additive on top of that.

## 9. Explicit non-goals (permanent, not deferred)

- No whole-repository indexing or cross-file taint analysis. Established during research to be technically unreliable at PR-diff scope; see `docs/PROBLEM_SPACE.md`.
- No hallucinated-package or slopsquatting detection. Already well covered by existing tools (Socket.dev, Aikido SafeChain); adding it here would duplicate, not differentiate.
- No auto-fix, at any point in this project's roadmap. Considered for what was originally planned as v4 and explicitly rejected; see section 8.
- No hosted dashboard or UI, at any point in this project's roadmap. v2's SARIF export gives teams that want a dashboard a path to GitHub's own Security tab instead of this project building one.
- No LLM calls, no ML models, no semantic reasoning, at any point in this project's roadmap. Considered for what was originally planned as v2 and explicitly rejected; see section 8.