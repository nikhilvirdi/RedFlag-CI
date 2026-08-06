# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and versioning follows [Semantic Versioning](https://semver.org/), with the specific convention described in `architecture.md` section 8.

## [Unreleased]

No unreleased changes yet.

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