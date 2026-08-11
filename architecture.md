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

### v1.2.0 additions (Phase 5)

Six further detectors, all dispatched alongside DD-1 through DD-4 against the same diff-drift-monitored files. Five of the six are current-state checks against head content only, not a base/head diff -- an unpinned dependency, an obfuscated command, a duplicate key, a suspicious network target, or a path-traversal sequence is a live risk on every PR it's still present in, not just the PR that introduced it. The sixth, transport-type change, is a diff check like DD-1 through DD-4, since "changed transport" is inherently a before/after comparison.

**Unpinned MCP dependency** (`diff-drift.unpinned-mcp-dependency`). For every MCP server entry whose command is `npx`, checks whether the package argument carries an explicit `@version` pin. No pin means npx always resolves to whatever release is currently published on the registry, so a compromised or malicious package update reaches every agent invocation immediately, with no PR for anyone to review. Severity: `warning`.

**Obfuscated command** (`diff-drift.obfuscated-command`). Scans MCP server commands and arguments, and hook commands, for two patterns: output piped directly into a shell (`| sh` or `| bash`), and a long base64-looking token (20 or more base64-alphabet characters, excluding tokens that are hex digits end to end, which excludes git hashes and checksums from matching on charset alone). Either pattern lets a payload pass through review as opaque or pre-execution text while a shell or interpreter still runs it. Severity: `high`.

**Duplicate top-level JSON key** (`diff-drift.duplicate-json-key`). A raw-text scan, not a `JSON.parse`-based one, since parsing silently collapses a duplicate key onto its last occurrence before any code built on the parsed object could ever see it. Flags a top-level key (for example, a second `mcpServers`) appearing more than once in the file. Some JSON parsers resolve a duplicate to its last occurrence, others to its first, so a second occurrence can smuggle a payload past a reviewer who only reads the first, legitimate-looking one. Severity: `warning`.

**Suspicious network target** (`diff-drift.suspicious-network-target`). Scans MCP server arguments and environment variable values for a non-HTTPS `http://` URL or a bare IPv4 address, excluding localhost/loopback targets and an IP already following an `https://` or `http://` prefix (already covered by the URL check). Unencrypted HTTP exposes traffic and credentials to interception; a bare IP bypasses domain validation, TLS certificate verification, and DNS governance. Severity: `warning`.

**Path traversal** (`diff-drift.path-traversal`). Scans MCP server arguments and environment variable values for a `../` or `..\` sequence. Navigating outside an expected directory boundary this way can expose sensitive system files or escape directory sandboxing. Severity: `warning`.

**Transport-type change** (`diff-drift.transport-type-change`). For a server entry present in both base and head, flags a flip between a "local" shape (a `command`, no `url` or `transport`) and a "remote" shape (`url` and/or `transport`, no `command`), in either direction. A locally-run process executes with local privileges and is visible in the repo; a remote endpoint executes outside your control and receives whatever the agent sends it. This is a trust-boundary jump independent of any single field's value, and DD-2's own command-field comparison may already report the same entry as changed, but only generically -- this reports specifically that the server's transport changed. Severity: `high`.

**RF-1/RF-2 extended to JSON keys.** RF-1 and RF-2 originally only scanned rule-file prose (`CLAUDE.md`, `.cursor/rules/*`, `.github/copilot-instructions.md`). Phase 5 extends their reach, unchanged, to MCP server names and permission allow/deny entries in diff-drift files -- identifier-like JSON strings a human reviewer tends to skim past. Not a new detector ID: findings still carry `rule-file.invisible-unicode` or `rule-file.homoglyph`, at the same severities as section 5's rule-file entries above.

**DD-8: Monitored file deleted** (`diff-drift.monitored-file-deleted`). DD-1 through DD-7 all correctly return no findings when a file's head content is absent -- there's nothing left to compare. But a monitored file's outright deletion is itself the most severe possible change: every permission, hook, and server definition it held disappears in one PR, with every per-detector null-head check independently and correctly staying silent about it. DD-8 closes that gap at the dispatch level, not inside any individual detector: for a diff-drift file present in base and absent in head, it fires once, in place of DD-1 through DD-7 (which have nothing to scan anyway). Severity: `high`.

**Cross-cutting: Unicode normalization.** Not a numbered detector, but a change that applies to every one of them. All string comparisons and set-membership checks -- server keys, permission entries, hook fields -- normalize to NFC (`String.prototype.normalize('NFC')`) before comparing, everywhere in the codebase. Without this, two byte-different but visually identical representations of the same string (for example, an accented character as one precomposed code point versus a base letter plus a combining mark) could either dodge a "same entry" match and read as a spurious add/remove pair, or let a duplicate-key/duplicate-server-name attack slip past a check that only compares raw, un-normalized strings.

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

This roadmap is closed. v2.0.0 is the final release. No version beyond it exists, and none will be added; the project is complete.

### v1.1.0 [SHIPPED]: dual deterministic engine

The complete scope of sections 3 through 7. Ships as a stateless service with no persistence layer. Hardened once already post-launch: the benchmark corpus grew from 18 to 120 scenarios across six rounds of stress-testing, surfacing one real detector defect (fixed) and five further precision/recall gaps (all fixed). See `CHANGELOG.md` and `docs/STRESS_TESTING.md`.

### v1.2.0 [SHIPPED]: detector hardening and pipeline correctness

A second hardening pass, still fully within v1's deterministic design, no new capability tier. Covers three kinds of work:

- **Detection fixes**, closing gaps the 120-scenario benchmark documented as known limitations rather than defects: RF-2 adopts Unicode's official confusables table in place of the hand-picked one; RF-1's character ranges expand to cover combining diacriticals and the Unicode Tags block; DD-1 and DD-3 gain shared remove/add correlation logic so a rename or a narrowing no longer reads as a brand-new, unreviewed entry; DD-2's argument comparison becomes order-insensitive for flagged (non-positional) arguments; DD-1's `mcpServers`/`servers` dual-key handling is fixed to merge rather than short-circuit.
- **New deterministic detectors**, closing gaps that were simply out of scope before: unpinned MCP dependency versions, obfuscated commands (base64 blobs, shell piping), homoglyphs and invisible-Unicode in JSON config keys as well as markdown rule files, duplicate top-level JSON keys, suspicious network targets (bare IPs, non-HTTPS URLs), path traversal in args/env, a local-to-remote MCP transport-type change, and project-wide Unicode normalization before any string comparison.
- **Pipeline correctness**, independent of detection logic: PR comment and check-run idempotency on `synchronize` events (edit the existing comment instead of posting a new one on every push, so the tool stays quiet the way its own design principles require), webhook delivery deduplication via the `X-GitHub-Delivery` header, and an audit confirming Octokit's rate-limit/throttling handling is actually wired in, so a rate-limit failure can't be silently absorbed by the fail-open policy and reported as "clean."

The benchmark corpus expands again in this version, incorporating real-world-sourced scenarios where they can be found, in addition to continued deliberate stress-testing. The exact final scenario count is determined during this version's development, not fixed in advance; what matters is coverage, not a target number.

### v2.0.0 [SHIPPED]: cross-PR drift memory and interoperable output

The last version this project has. No version beyond it exists, and none will be added -- with Phase A and Phase B both complete, there is nothing left on the roadmap to build.

**Phase A: cross-PR drift memory.** v1 and v1.2.0 were both fully stateless: every check compared a PR's base branch to its head branch, with no memory of anything outside that single diff. The benchmark's own stress-testing had documented the resulting blind spot directly: two small, individually unremarkable permission widenings across two separate pull requests each looked fine on their own, because nothing tracked a pattern across PRs. Phase A closes this without a database (`src/baseline.ts`): a small JSON snapshot, storing each monitored diff-drift file's raw content exactly as it stood at the last merge, is committed to a dedicated `redflag-ci/baseline` branch. Not Postgres, and this reaffirms the same reasoning that already ruled a database out for v1 -- section 2's "no dashboard" design principle means a persistence layer backing data nobody's UI displays is unused surface area, and it would break the zero-config, install-and-it-works promise the whole project is positioned on. A git branch gives durable, versioned, access-controlled storage with no hosting requirement, which is everything this feature actually needed.

The snapshot updates only when a PR actually merges (`src/baselineUpdate.ts`): the signal is the `pull_request` webhook's `closed` action with `merged: true`, not a `push` event to the base branch. A push fires for any commit landing there -- a direct push, a force-push, a merge done outside a reviewed PR -- not only a genuine merge, and carries no PR number to correlate back to one, so it can't reliably distinguish "a PR actually merged" from "something else changed this branch." An unmerged PR can never influence the stored baseline, even indirectly. Detection (`src/cumulativeDrift.ts`) then compares the current PR against this stored baseline in addition to its own base branch, by feeding the baseline's stored content into the exact same detectors that already compare base to head -- no separate comparison logic duplicated. Because the snapshot is overwritten on every merge, it always reflects the cumulative effect of every merge before it, not only the one immediately preceding the current PR, which is what actually catches two individually-unremarkable widenings landing across two separate pull requests. The baseline branch's own protection status is checked after every write, and a missing one is logged as a warning, since an unprotected branch could be pushed to directly, bypassing the merge-only update path entirely; the stored snapshot also carries a SHA-256 integrity hash, verified on every read, so tampering outside that path is caught and logged distinctly rather than silently trusted. When the cross-PR check fires, the PR comment gets its own dedicated section showing exactly what changed since the baseline, not merged invisibly into the PR's own findings list.

**Phase B: SARIF and JSON export.** Not a new detector, just two additional, machine-readable serializations of findings the tool already produces, plus an advisory exit-code helper. All three (`src/exportSarif.ts`, `src/exportJson.ts`, `src/exitCodeThreshold.ts`) are pure functions -- no I/O, tested independently, and deliberately not called from `processPullRequestEvent.ts` or `postFindings.ts`. A team wires them into a separate GitHub Actions workflow of their own (a full worked example lives in `docs/EXPORTS.md`): SARIF output uploads to GitHub's native Security tab via a standard `upload-sarif` step, so RedFlag CI gets dashboard-equivalent visibility for teams that want it without this project ever hosting or building one; the plain JSON export covers teams whose tooling doesn't consume SARIF; and the opt-in exit-code threshold lets a team choose to fail their own build on findings at a chosen severity, entirely on the consuming side. None of this touches RedFlag CI's own check run, which still reports only `success` or `neutral` and never `failure`, exactly as it always has.

The 138-scenario benchmark corpus is unchanged by v2.0.0, deliberately: it stayed single-PR-scoped by construction (one before/after file pair per scenario), and Phase A's stateful, sequential, webhook-timing-dependent behavior doesn't fit that shape. Cross-PR behavior is covered instead by integration tests exercising the real dispatch pipeline against a mocked baseline. See `docs/STRESS_TESTING.md` for the full reasoning.

### What was scoped and explicitly rejected, not deferred

An earlier draft of this roadmap planned four major versions: v2 as an opt-in LLM adjudication tier, v3 as Postgres-backed persistence and broader file coverage, and v4 as MCP behavioral scanning, auto-fix PRs, SARIF export, and a dashboard. After scrutiny, most of that was cut, not postponed:

- **LLM adjudication tier and a custom-trained ML model (both considered, both rejected).** Either would abandon the deterministic, zero-noise design this entire project is built around, and would duplicate ground already claimed by funded, cloud-based semantic scanners (Invariant Guardrails, MCP-Guard) rather than defending RedFlag CI's actual differentiator. Nearly every concrete gap this tier was meant to close (the uncommon-homoglyph miss, the legitimate-multilingual-text false positive) turned out to have a deterministic fix instead -- see v1.2.0 above.
- **Full Postgres persistence and a trend dashboard.** Cut for the same reason: v1 explicitly names "no dashboard" as a design principle, so a database backing trend data nobody's UI displays is pure unused surface area, and it breaks the zero-config, install-and-it-works promise the whole project is positioned on. The one genuinely real gap this was meant to close -- cross-PR drift -- survives, but is solved the lightweight way in v2.0.0's Phase A instead, with no database and no hosting requirement.
- **MCP server behavioral/semantic scanning.** Cut. This requires actually running MCP servers to observe their behavior, which is both a real safety risk (see `backend/benchmark/COMPARISON.md`'s discussion of why this comparison declined to execute untrusted servers) and already well-covered ground (mcp-scan, AgentShield), per `docs/COMPETITIVE_LANDSCAPE.md`.
- **Auto-fix PRs.** Cut. Auto-generating code changes is a different trust model than flagging a risk (act vs. inform), a materially larger liability surface, and crowded, funded territory (CodeRabbit, Greptile) RedFlag CI was never trying to compete on.
- **SARIF export survives, narrowed.** Of the original v4 scope, only this earns its place, and it moves into v2.0.0 Phase B rather than staying a hypothetical fourth tier, since it's an output format on top of existing findings, not new detection logic or new infrastructure.

**Deprecation policy:** every version from v1.2.0 onward is additive; nothing added in a later version changes what an earlier version already does by default. v1.2.0's new detectors run by default (they're the same category as v1's existing ones). v2.0.0's cross-PR memory and export options are additive on top of that.

## 9. Explicit non-goals (permanent, not deferred)

- No whole-repository indexing or cross-file taint analysis. Established during research to be technically unreliable at PR-diff scope; see `docs/PROBLEM_SPACE.md`.
- No hallucinated-package or slopsquatting detection. Already well covered by existing tools (Socket.dev, Aikido SafeChain); adding it here would duplicate, not differentiate.
- No auto-fix, at any point in this project's roadmap. Considered for what was originally planned as v4 and explicitly rejected; see section 8.
- No hosted dashboard or UI, at any point in this project's roadmap. v2's SARIF export gives teams that want a dashboard a path to GitHub's own Security tab instead of this project building one.
- No LLM calls, no ML models, no semantic reasoning, at any point in this project's roadmap. Considered for what was originally planned as v2 and explicitly rejected; see section 8.