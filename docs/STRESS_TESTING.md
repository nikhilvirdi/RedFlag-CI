# Stress-Testing RedFlag CI

RedFlag CI shipped as v1.0.0 with a working pipeline and an 18-scenario benchmark behind it. Before calling it done, we went back and tried to break it on purpose: 120 test cases, built specifically to find the tool's real limits rather than to produce a clean-looking report. This document explains what we tested, what we found, what we fixed, and what we chose to leave alone.

## Why 18 wasn't enough

The original benchmark proved the six detectors worked: one clean example each, a few benign controls, a handful of near-misses. That's enough to confirm a tool does what it says. It's not enough to know where it breaks.

So we expanded it, in six rounds, each aimed at a different way of trying to trip the detectors up.

## The six rounds

**Deeper coverage per detector.** Each of the six detectors had one canonical example in the original corpus. We pushed each to four or five: different schema shapes, minimal configs, multiple simultaneous changes, unicode in server names, env-var swaps, version-hash changes. The goal was breadth within what each detector was already built to catch.

**Judgment calls.** Ten scenarios built around cases where the "correct" answer isn't obvious -- a server removed and re-added identically, a hook's command changed to an empty string, a permission entry whose casing changes but nothing else. We recorded what the detectors actually do in each case rather than assuming any particular answer was right, and flagged the debatable ones as debatable.

**Fail-open under stress.** RedFlag CI is built to never block a PR, even on a file it can't parse. We tested that promise against fourteen kinds of malformed input: truncated JSON, wrong types, null bytes, invalid UTF-8, a 500KB file. Every one of them produced zero findings and no crash. We also confirmed detection still works correctly at scale -- twenty-entry permission lists, ten-plus MCP servers, minified single-line JSON.

**Unusual encodings and multiple detectors at once.** Fourteen scenarios probing character encodings the detectors had never been tested against: UTF-16 byte-order marks, Unicode normalization differences, fullwidth Latin letters, mathematical alphabet symbols, Armenian and Cherokee scripts. Several of these were built to fail on purpose, to document real gaps rather than paper over them. A separate seven scenarios confirmed that when two detectors should both fire on the same change, they do, independently, without one suppressing the other.

**Benign changes and deliberate evasion.** Ten scenarios of things a real developer does that shouldn't cause alarm -- a typo fix, a version bump, reorganizing hooks for clarity. Paired with ten scenarios trying to actively evade detection: renaming a server while also swapping its command, splitting a suspicious payload across multiple argument entries, hiding a homoglyph somewhere no detector looks.

## What we found: a real bug

One of the deep-coverage scenarios in the first round caught a genuine defect, not a tradeoff. DD-3's wildcard check was a plain substring match -- it flagged any permission containing a literal `*` as an unrestricted grant, at the tool's highest severity level. That meant a narrow, ordinary permission like `Read(src/**)` got treated the same as `Bash(*)`, an actually unrestricted command.

We fixed it before continuing: a wildcard now only escalates when it occupies the entire permission body, not when it's part of a longer, scoped pattern. Verified against both the bug case and the original unrestricted-wildcard case, so the fix didn't just trade one false positive for a missed real threat.

## What we found: five more gaps, closed after the full run

Once all 120 scenarios were built and run together, five more real gaps showed up -- not bugs in the sense that the code was doing something other than what it was built to do, but real, closeable limits:

- RF-1 was missing two genuinely invisible characters: the soft hyphen and the standalone right-to-left mark.
- RF-2's look-alike character table stopped at Cyrillic and Greek. Fullwidth Latin letters, mathematical alphabet symbols, Armenian, and Cherokee were all invisible to it.
- DD-2 compared a server's command, arguments, and version, but never its environment variables -- even though redirecting a server via an env var is the same shape of attack as swapping its command.
- DD-3 recognized `Bash(*)` as unrestricted but missed the equally unrestricted bare `Bash` with no arguments at all, since that shape has no literal asterisk to catch.
- DD-4 had no whitespace tolerance, so a purely cosmetic hook-command reformat counted as a change. It also never looked at a hook's matcher field, only its command, so widening what a hook applies to went unnoticed if the command itself stayed the same.

All five got fixed. Each fix was verified against the specific scenario that found it, and the full test suite was re-run to confirm nothing else broke.

## What we found: accepted tradeoffs, left alone

Not everything that misfires is worth fixing. Three false positives from the original benchmark are still there, on purpose:

- Reordering an MCP server's arguments still counts as a change, even when the reorder is harmless, because argument order can matter and the detector has no way to know when it doesn't.
- A genuine sentence written in Cyrillic still trips the homoglyph detector, because it's a character-class check with no concept of language -- it can't tell a real Cyrillic sentence from a single homoglyph hidden in English text.
- Renaming an MCP server without changing anything else still reads as a brand-new, unreviewed entry, because the detector only ever looks at keys, not history.

Fixing any of these properly means giving a detector judgment it currently doesn't have -- correlating a removal with an addition, or reasoning about language, or tracking identity across a rename. That's a different kind of tool than the one this project deliberately chose to build for v1. The reasoning for that choice, and why it's worth the cost, is in `docs/adr/0001-deterministic-only-v1.md`.

## What we found: limits that aren't fixable within this design at all

A few of the adversarial scenarios weren't testing for a bug. They were testing the edges of what a diff-scoped, stateless tool can see at all:

- A hook that calls an external script can be flagged for being added, but nothing here can see what that script actually does, because the script itself isn't a monitored file. This one stays out of scope permanently: watching arbitrary script contents means watching arbitrary code, which is a different, much larger problem than the config-file supply chain this project targets, and it's the kind of scope creep the project's own competitive research (`docs/COMPETITIVE_LANDSCAPE.md`) warns against chasing.
- Renaming a server and swapping its command in the same change gets flagged as "new server added" -- correct, but it doesn't specifically call out that the command was also swapped, since the old key never existed in the base branch's data to compare against. This is closed in v1.2.0: shared remove/add correlation logic lets DD-1 recognize a paired rename and, when the paired entry's command or args also changed, say so explicitly instead of only reporting "new server."
- Two small, individually unremarkable permission widenings across two separate pull requests each look fine on their own. Nothing here tracks a pattern across pull requests, because v1 has no memory beyond the current diff. This is closed in v2: a small git-native baseline snapshot (not a database) gives the tool enough memory to track cumulative widening across merges, without breaking the zero-config, stateless design for everything short of that one capability.

The first of these three is structural and permanent. The other two turned out not to need the heavier persistence layer and behavioral-scanning tier an earlier draft of the roadmap planned for them -- see `architecture.md` section 8 for the full reasoning on what was cut from that draft and what was kept in a lighter form instead.

## The numbers, start to finish

| | Precision | Recall |
|---|---|---|
| Original 18-scenario benchmark | 0.727 | 0.889 |
| Full 120-scenario corpus, before fixes | 0.892 | 0.846 |
| After the five gaps were closed | 0.926 | 0.949 |

Recall dropped in the middle row, and that's expected, not a regression: a much larger, deliberately adversarial corpus surfaces more of what the tool actually misses. Precision improved throughout, mostly because the larger corpus added far more scenarios that correctly stay quiet than ones that misfire -- only 5 of the corpus's 8 total false positives are new since the original 18. Once the five real gaps were fixed, both numbers moved past where they started.

Every one of the 120 scenarios was checked individually against what it was built to demonstrate. All 120 matched.

## Compared to what else is out there

We ran the same original benchmark against Snyk Agent Scan (the tool most people know as mcp-scan). It couldn't render a verdict on any of the 18 files, for three separate reasons: it doesn't parse markdown rule files at all, its schema doesn't cover permissions or hooks, and reaching an actual verdict on MCP server configs requires a cloud account and running the servers themselves, neither of which RedFlag CI's own headless, zero-config design requires. The full comparison, including exactly what was tried and why, is in `backend/benchmark/COMPARISON.md`.

## Where to look next

- `backend/benchmark/RESULTS.md` -- the full 120-scenario results table, generated fresh by the benchmark runner.
- `backend/benchmark/COMPARISON.md` -- the live comparison against Snyk Agent Scan.
- `docs/adr/0001-deterministic-only-v1.md` -- why v1 is deterministic-only, and the honest cost of that choice.
- `CHANGELOG.md` -- the exact fixes that shipped in v1.1.0.

This corpus isn't final. v1.2.0 and v2 (the project's last planned version, see `architecture.md` section 8) each expand it further, with the same philosophy: hunt for real gaps deliberately, document what's found honestly, and don't stop once the numbers look clean.