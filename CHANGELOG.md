# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and versioning follows [Semantic Versioning](https://semver.org/), with the specific convention described in `architecture.md` section 8.

## [Unreleased]

No unreleased changes yet.

## [2.0.0] - 2026-08-08

**A major version bump, not just a feature release: this is the project's first stateful version.** Every prior release (v1.0.0 through v1.2.0) was fully stateless -- no persistence layer, no memory of anything beyond a single PR's own base/head diff, by explicit design principle (`architecture.md` section 2). v2.0.0 breaks that guarantee for the first time: RedFlag CI now writes to a dedicated branch in the repos it's installed on, not just reads from them, and a PR's comment can now depend on state left behind by a *different, earlier* pull request. The persistence stays deliberately minimal -- a JSON file on a git branch, not a database -- but the guarantee itself changed, which is why this ships as 2.0.0 and not 1.3.0. This is also the project's last planned version: the original roadmap named v2 as the final release, and with Phase A and Phase B both complete, there is nothing left on it.

**A post-ship hardening pass (Stage 3) followed the initial Phase A/B build**, still within this same `[2.0.0]` release: a dependency and dead-code audit, a full code-review pass across every file in `backend/src`, a statement/branch coverage investigation, and a 23-scenario adversarial stress-test sweep built from two deliberately independent sources. Full results, including what was found and left alone on purpose, in `TRANSPARENCY_REPORT.md`.

### Added

- **Git-native baseline snapshot** (`src/baseline.ts`): a small JSON file, committed to a dedicated `redflag-ci/baseline` branch, storing each monitored diff-drift file's raw content as of the last merge. Not Postgres -- reaffirms the same reasoning that already ruled a database out for v1 (`architecture.md` section 8): a persistence layer backing data nobody's UI displays is unused surface area that breaks the zero-config, install-and-it-works promise the whole project is built on. A git branch gives durable, versioned, access-controlled storage with no hosting requirement.
- **Merge-only baseline updates** (`src/baselineUpdate.ts`): the snapshot updates only on an actual PR merge -- the `pull_request` webhook's `closed` action with `merged: true` -- never on `opened`/`synchronize`, and never for a PR closed without merging. Chosen over a `push`-to-base-branch signal, which fires for any commit landing there (a direct push, a force-push, a merge outside a reviewed PR), not only a genuine merge, and carries no PR number to correlate back to one.
- **Cumulative-widening detection** (`src/cumulativeDrift.ts`): the current PR is now compared against the stored baseline, in addition to its immediate base branch, by feeding the baseline's content into the exact same detectors that already compare base to head -- no separate comparison logic duplicated. Since the baseline is overwritten on every merge, it always reflects every merge before it, not only the one immediately preceding the current PR, which is what catches two individually-unremarkable permission widenings landing across two separate pull requests -- a real, previously-documented blind spot (`docs/STRESS_TESTING.md`'s own `adversarial-gradual-drift-two-prs` scenario) no single-PR-scoped check could ever see.
- **Baseline branch protection check**: verified after every merge-triggered write; a missing one is logged as a warning (Winston), since an unprotected `redflag-ci/baseline` branch could be pushed to directly, bypassing the merge-only update path entirely.
- **Snapshot integrity hash**: a SHA-256 hash is stored alongside the snapshot and verified on every read. A mismatch is logged as a distinct, named condition -- the same pattern as v1.2.0's rate-limit logging -- rather than folded into a generic "couldn't read the baseline" silence. Still fails open: a tampered snapshot is never trusted and used anyway, it's treated exactly like an unavailable one.
- **Baseline drift in the PR comment**: when the cross-PR check fires, the comment gets its own labeled section ("N additional changes found since the last known-good baseline"), reusing the same bullet formatting as the main findings list, so a reviewer can tell "this is my PR's own diff" apart from "this is drift I didn't cause in this PR."
- **SARIF export** (`src/exportSarif.ts`): a pure function producing a SARIF 2.1.0-compliant JSON string from any findings list, for uploading to GitHub's native Security tab via a standard GitHub Actions step.
- **Plain JSON export** (`src/exportJson.ts`): a pure function producing a minimal JSON envelope, for consumers whose tooling doesn't consume SARIF.
- **Opt-in CI exit-code threshold** (`src/exitCodeThreshold.ts`): a pure, advisory helper a team can call from their own CI step to fail their own build on findings at a chosen severity. Returns `0` unless a threshold is explicitly passed, so it's opt-in by construction. Does not, and cannot, touch RedFlag CI's own check run, which still reports only `success` or `neutral`.
- **DD-8: monitored file deleted** (`diff-drift.monitored-file-deleted`): found during the Stage 3 review pass. DD-1 through DD-7 all correctly return no findings when a diff-drift file's head content is absent -- there's nothing left to compare -- but that left a monitored file's outright deletion, the single most severe possible change to it, producing the quietest possible output. DD-8 fires once at dispatch level, in place of DD-1 through DD-7, whenever a diff-drift file is present in base and gone in head. Severity: `high`. Full spec in `architecture.md` section 5.

### Fixed

Stage 3's post-ship audit (`TRANSPARENCY_REPORT.md`) found and fixed real issues across four passes. Briefly, not repeated in full here:

- **18 findings from a full end-to-end code-review pass** across every file in `backend/src` -- 17 fixed (a reintroduced schema short-circuit bug, a missing pagination call, a concurrent-comment-posting race, a hooks-schema mismatch against Claude Code's real `settings.json` shape, and thirteen more), 1 confirmed as an intentional, permanent scope limitation rather than a defect. Full list in `TRANSPARENCY_REPORT.md` section 2.
- **1 real bug found via a coverage investigation**: `suspiciousNetworkTarget.ts` exempted a bare IP behind both `http://` and `https://` prefixes from its bare-IP check, when only `http://` needed the exemption (already caught by the separate insecure-HTTP finding) -- a bare IP behind HTTPS, which still bypasses domain validation, TLS certificate checks, and DNS governance, was passing through both checks silently. Fixed by narrowing the exemption to `http://` only. Five further coverage gaps closed with genuine new tests, one line of confirmed-unreachable dead code removed. Full list in `TRANSPARENCY_REPORT.md` section 3.
- **2 fixes from a 23-scenario adversarial stress-test sweep**, built from two deliberately independent sources to counter reviewer bias: a fullwidth Unicode solidus (`／`, U+FF0F) rendered as a near-identical slash to a human reviewer but was invisible to path-traversal detection's ASCII-only separator regex, now fixed to recognize the fullwidth forms alongside the ASCII ones; a baseline snapshot could carry a correctly-computed hash over content that was itself unparseable JSON, a case the existing tamper-detection logic never checked for, producing complete silence -- now checked and logged distinctly, the same pattern used for every other baseline failure mode. Two further scenarios surfaced real evasions left as documented, permanent tradeoffs rather than fixed, for the same reasoning already applied elsewhere in this project's design (see `docs/adr/0001-deterministic-only-v1.md`). Full results in `backend/STRESS_TEST_FINDINGS.md`; summary in `TRANSPARENCY_REPORT.md` section 4 and `docs/STRESS_TESTING.md`.

### Changed

- `postFindings.ts` gains an optional `cumulativeFindings` parameter and `formatFindingsComment.ts` gains `formatCumulativeDriftSection`, both additive -- every pre-v2.0.0 caller needs no changes, and a repo with no baseline yet behaves exactly as it did in v1.2.0.
- **None of Phase B's three export functions are wired into the webhook pipeline.** They're tested, exported utilities a team calls from their own separate GitHub Actions workflow (worked example in `docs/EXPORTS.md`), not something RedFlag CI's own GitHub App invokes automatically. This is the intended design, not a gap: it keeps the export formats opt-in on the consuming side.
- `architecture.md` section 8's v2.0.0 entry rewritten from a planned roadmap description to a shipped-version writeup, matching v1.2.0's format; v1.2.0 itself re-tagged `[SHIPPED]` (previously `[ACTIVE]`) for consistency, since it's no longer the newest version.
- Benchmark corpus unchanged by the original Phase A/B build, at 138 scenarios, precision/recall 1.000/1.000 (see `backend/benchmark/RESULTS.md`) -- deliberately: the corpus format is one before/after file pair per scenario ID representing a single PR, and genuinely simulating a merge-then-PR sequence would mean building baseline/Octokit simulation into the benchmark runner itself. Cross-PR behavior is covered instead by integration tests exercising the real webhook-to-comment pipeline against a mocked baseline. See `docs/STRESS_TESTING.md`.
- Stage 3 grew the corpus from 138 to 139 scenarios (DD-8's own scenario, `dd8-monitored-file-deleted`); precision and recall stayed at 1.000/1.000. Test suite grew from 386 to 481 tests across 35 suites. `npm audit` now reports zero vulnerabilities (two high-severity issues, both in transitive dev-dependency tooling and unreachable from any shipped runtime path, fixed via `npm audit fix`). Final numbers for this release: **139 corpus scenarios, 481 tests, precision 1.000, recall 1.000, 0 known vulnerabilities.**

## [1.2.0] - 2026-08-08

A detector-hardening pass, working from what v1.1.0's own stress-testing had already documented as known gaps rather than from newly invented scenarios: three accepted false positives, one deliberate false negative, and three further limits found reading the same 120-scenario corpus. All closed with deterministic fixes, not a smarter model -- see `docs/adr/0001-deterministic-only-v1.md`'s second addendum for why an opt-in LLM tier was reconsidered and rejected instead. The benchmark corpus grew from 120 to 138 scenarios; two further, unrelated bugs turned up while building the regression tests themselves.

### Fixed

- **RF-2 now uses Unicode's official confusables.txt table** in place of the original hand-picked list, closing the `known-gap-uncommon-homoglyph` false negative (a Cyrillic U+0501 substitution went undetected).
- **RF-1 now covers the Combining Diacritical Marks block and the Unicode Tags block** (U+E0000-U+E007F), two invisible-character ranges the original table missed.
- **DD-1 now merges the `mcpServers` and `servers` schema keys** instead of using `??`, which silently discarded `servers` any time `mcpServers` was present at all, even empty.
- **DD-1 and DD-3 use a new shared remove/add correlation utility** to recognize a paired rename (DD-1) or a narrowing change (DD-3) by matching identity fields, instead of only ever comparing by key name. Closes `near-miss-mcp-server-rename`, `dd3-wildcard-narrowed-to-specific`, and `dd3-narrowing-syntax-rewrite`.
- **DD-2 now compares flagged (`--key value`-style) arguments as an unordered set**, leaving purely positional arguments order-sensitive. Closes `near-miss-args-reorder`.
- **RF-2 gains a per-word script-majority check**: a word that's mostly one non-Latin script reads as real language, not an attack; a word that's Latin except for one or two substituted characters still fires. Closes `near-miss-legit-cyrillic-text` and `judgment-rf2-latin-loanword-in-cyrillic-context`.
- **Every string comparison and set-membership check across every detector now normalizes to NFC first** -- server keys, permission entries, hook fields -- so two byte-different but visually identical Unicode representations of the same string are correctly treated as the same, everywhere, not only in RF-2.
- **PR comments and check runs are now idempotent across `synchronize` events**: RedFlag CI detects its own prior comment (via a stable HTML-comment marker) and check run (via a name/SHA lookup) and edits them in place instead of posting a new one on every push.
- **Webhook delivery deduplication**: a `synchronize`/`opened` event is skipped if its `X-GitHub-Delivery` header was already processed, preventing GitHub's own retry-on-timeout behavior from silently reprocessing an event -- which, after the idempotency fix above, would otherwise have re-edited the same comment/check run without any visible sign a retry had happened at all.
- **`@octokit/plugin-throttling` is now installed and wired into the Octokit client**; it was not previously, despite being implied by the fixed tech stack. A rate-limit failure that survives the plugin's retries is now logged as its own distinct condition (via a new Winston logger, also not previously wired in) rather than falling into the same generic catch block used for a malformed webhook payload.
- **DD-2 had the same `mcpServers ?? servers` short-circuit bug DD-1 had before its own schema-merge fix above, never ported over.** Found while building a regression fixture meant to confirm DD-2's precedence was correct; the fixture couldn't actually distinguish correct precedence from the short-circuit bug, since both produced the same result on it. Fixed with the same merge-with-precedence change, plus a companion scenario (`regression-dd2-servers-key-blind-spot`) that tests what the first fixture couldn't.
- **A stray NUL byte, embedded in `swappedMcpServer.ts`'s source since the original DD-2 argument-comparison commit, removed.** It sat where a space belonged in an internal comparison key. Never affected any finding (both sides of every comparison built the identical corrupted string either way), and TypeScript silently sanitized it into a space at compile time anyway, so the runtime string was never actually wrong -- but it was still a real defect in committed source, and the reason `git diff` rendered the file as binary.

### Added

- **Unpinned MCP dependency detector** (`diff-drift.unpinned-mcp-dependency`): flags an `npx`-run MCP server with no explicit version pin on its package argument.
- **Obfuscated command detector** (`diff-drift.obfuscated-command`): flags a command or argument that pipes output directly into a shell, or contains a long base64-looking blob.
- **Duplicate top-level JSON key detector** (`diff-drift.duplicate-json-key`): flags a top-level key (for example, a second `mcpServers`) appearing more than once in a monitored file.
- **Suspicious network target detector** (`diff-drift.suspicious-network-target`): flags a non-HTTPS `http://` URL or a bare IPv4 address in an MCP server's arguments or environment variables.
- **Path traversal detector** (`diff-drift.path-traversal`): flags a `../` or `..\` sequence in an MCP server's arguments or environment variables.
- **Transport-type change detector** (`diff-drift.transport-type-change`): flags an MCP server flipping between a local (command-based, stdio) and remote (url/transport-based) shape, in either direction -- a trust-boundary jump independent of any single field's value.
- **RF-1 extended to MCP server names**: invisible-Unicode scanning now also covers server name keys in diff-drift files, not just rule-file prose.
- **RF-2 extended to permission entries**: homoglyph scanning now also covers `.claude/settings.json` allow/deny entries, not just rule-file prose.

### Changed

- `architecture.md` section 5 gained full specs for all eight additions above, plus a cross-cutting note on the Unicode-normalization change (not a numbered detector, since it applies to every one of them).
- Benchmark corpus grew from 120 to 138 scenarios: 9 real-world-grounded scenarios (CVE writeups and documented techniques, via Task 7.1's research), 8 regression variants confirming each fix above generalizes past the single scenario that originally found it, and 1 more from the DD-2 bug found while building those regression variants. Benchmark results, recomputed against the full 138-scenario corpus: **precision 1.000** (up from 0.926), **recall 1.000** (up from 0.949). See `backend/benchmark/RESULTS.md` and `docs/STRESS_TESTING.md`.

## [1.1.0] - 2026-08-06

The benchmark corpus grew from 18 to 120 scenarios across six rounds of deliberate stress-testing, built specifically to find real problems before calling v1 done rather than to produce a clean-looking report. That stress-testing paid off: it caught one real detector defect during construction and five further precision/recall gaps once the full corpus was run, all of which got fixed.

### Fixed

- **DD-3 wildcard escalation** no longer misfires on scoped glob-style permissions like `Read(src/**)`. The original substring check (`entry.includes('*')`) escalated any permission containing a literal asterisk to `high` severity, regardless of whether that asterisk represented an unrestricted grant or just part of a narrow file-path pattern. Found via the benchmark's own corpus construction, not a later review pass.
- **RF-1's invisible-character set** was missing two real characters with no legitimate reason to appear in an instruction file: the soft hyphen (U+00AD) and the standalone right-to-left mark (U+200F). Both are now detected.
- **RF-2's confusable-character table** was missing four entire scripts/blocks of Latin look-alikes: fullwidth Latin letters, mathematical alphanumeric symbols, Armenian, and Cherokee. All four are now covered.
- **DD-2 now compares environment variables**, not just command, arguments, and pinned version. An env-var swap (for example, redirecting a server to a different endpoint) is functionally the same MCPoison-shaped risk as a command or argument swap, and was previously invisible to this detector.
- **DD-3 now recognizes a bare tool name with no arguments** (for example, `Bash` with no parentheses) as an unrestricted grant, escalating it to `high` the same way `Bash(*)` already does. Previously this equally broad permission shape didn't contain a literal asterisk, so it only fired as a `warning`.
- **DD-4 now normalizes whitespace** before comparing hook commands, so a purely cosmetic formatting change no longer produces a false alarm. It also **compares each hook's matcher/trigger scope**, not just its command -- broadening what a hook applies to (for example, from `Bash` to `*`) is a real widening of the hook's effective reach even when the command itself doesn't change.

### Changed

- `architecture.md` section 5's DD-2 and DD-4 specs were updated to explicitly name environment variables and matcher/trigger scope as compared fields, matching the fixes above.
- Benchmark results, recomputed against the full 120-scenario corpus after these fixes: **precision 0.926** (up from 0.727), **recall 0.949** (up from 0.889). See `backend/benchmark/RESULTS.md`.

## [1.0.0] - 2026-08-06

v1 is feature-complete: all seven phases of `workplan.md` are done, scaffolding through the Phase 7 benchmark, ADR, and competitor comparison.

### Added

- **Diff-drift engine**, watching `.mcp.json`, `.cursor/mcp.json`, `claude_desktop_config.json`, and `.claude/settings.json`:
  - DD-1: a new MCP server added between the base and head branches.
  - DD-2: a pinned tool, command, argument, or version swapped on an already-approved MCP server entry -- the MCPoison pattern (CVE-2025-54136).
  - DD-3: a permission or allow-list widened, or a deny rule removed, in `.claude/settings.json`.
  - DD-4: a hook added or its command changed in `.claude/settings.json` -- the pattern behind CVE-2025-59536.
- **Rule-file engine**, watching `CLAUDE.md`, `.cursor/rules/*`, and `.github/copilot-instructions.md`:
  - RF-1: invisible Unicode (zero-width spaces, zero-width joiners, bidirectional-control characters).
  - RF-2: Cyrillic/Greek homoglyphs substituted for Latin characters.
- **Full webhook-to-comment pipeline**: GitHub App authentication, changed-file fetching, monitored-file filtering, base/head content fetching, detector dispatch, findings aggregation sorted by severity, and posting a single PR comment plus a check run (`success` or `neutral`; the check is never failed).
- Deterministic-only detection, fail-open on malformed config, least-privilege GitHub App permissions, zero-config install, and a stateless design with no persistence layer, carried through the whole pipeline per `architecture.md` section 2.
- Benchmark results (`backend/benchmark/RESULTS.md`): an 18-scenario adversarial corpus covering all six detectors, genuinely benign changes, and deliberately adversarial near-miss/known-gap cases, measuring **precision 0.727, recall 0.889**, including three documented false positives and one documented false negative -- recorded as known limitations of the deterministic-only design, not defects.
- ADR 0001 (`docs/adr/0001-deterministic-only-v1.md`): documents the deterministic-only, precision-over-recall decision against the real benchmark numbers above, including an explicit correction to `architecture.md` section 5's "near-zero false-positive rate" claim, which does not hold for RF-2 on repositories with legitimate multilingual content.
- Competitor comparison (`backend/benchmark/COMPARISON.md`): a live run of mcp-scan (now Snyk Agent Scan) against the same 18-scenario corpus, documenting where its scope does, and mostly doesn't, overlap with RedFlag CI's.