# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and versioning follows [Semantic Versioning](https://semver.org/), with the specific convention described in `architecture.md` section 8.

## [Unreleased]

No unreleased changes yet.

## [1.0.0] - 2026-08-06

v1 is feature-complete: all seven phases of `workplan.md` are done, scaffolding through the Phase 7 benchmark, ADR, and competitor comparison.

### Added

- **Diff-drift engine**, watching `.mcp.json`, `.cursor/mcp.json`, `claude_desktop_config.json`, and `.claude/settings.json`:
  - DD-1: a new MCP server added between the base and head branches.
  - DD-2: a pinned tool, command, argument, or version swapped on an already-approved MCP server entry — the MCPoison pattern (CVE-2025-54136).
  - DD-3: a permission or allow-list widened, or a deny rule removed, in `.claude/settings.json`.
  - DD-4: a hook added or its command changed in `.claude/settings.json` — the pattern behind CVE-2025-59536.
- **Rule-file engine**, watching `CLAUDE.md`, `.cursor/rules/*`, and `.github/copilot-instructions.md`:
  - RF-1: invisible Unicode (zero-width spaces, zero-width joiners, bidirectional-control characters).
  - RF-2: Cyrillic/Greek homoglyphs substituted for Latin characters.
- **Full webhook-to-comment pipeline**: GitHub App authentication, changed-file fetching, monitored-file filtering, base/head content fetching, detector dispatch, findings aggregation sorted by severity, and posting a single PR comment plus a check run (`success` or `neutral`; the check is never failed).
- Deterministic-only detection, fail-open on malformed config, least-privilege GitHub App permissions, zero-config install, and a stateless design with no persistence layer, carried through the whole pipeline per `architecture.md` section 2.
- Benchmark results (`backend/benchmark/RESULTS.md`): an 18-scenario adversarial corpus covering all six detectors, genuinely benign changes, and deliberately adversarial near-miss/known-gap cases, measuring **precision 0.727, recall 0.889**, including three documented false positives and one documented false negative — recorded as known limitations of the deterministic-only design, not defects.
- ADR 0001 (`docs/adr/0001-deterministic-only-v1.md`): documents the deterministic-only, precision-over-recall decision against the real benchmark numbers above, including an explicit correction to `architecture.md` section 5's "near-zero false-positive rate" claim, which does not hold for RF-2 on repositories with legitimate multilingual content.
- Competitor comparison (`backend/benchmark/COMPARISON.md`): a live run of mcp-scan (now Snyk Agent Scan) against the same 18-scenario corpus, documenting where its scope does, and mostly doesn't, overlap with RedFlag CI's.