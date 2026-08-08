# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and versioning follows [Semantic Versioning](https://semver.org/), with the specific convention described in `architecture.md` section 8.

## [Unreleased]

No unreleased changes yet.

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