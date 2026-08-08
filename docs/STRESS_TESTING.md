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
| 138-scenario corpus, after v1.2.0 | 1.000 | 1.000 |

Recall dropped in the middle row, and that's expected, not a regression: a much larger, deliberately adversarial corpus surfaces more of what the tool actually misses. Precision improved throughout, mostly because the larger corpus added far more scenarios that correctly stay quiet than ones that misfire -- only 5 of the corpus's 8 total false positives are new since the original 18. Once the five real gaps were fixed, both numbers moved past where they started. The last row is v1.2.0's own hardening pass, covered below -- what specifically closed to get there, not just the number.

Every one of the 120 scenarios was checked individually against what it was built to demonstrate. All 120 matched. The 18 scenarios added in v1.2.0 were checked the same way; see below.

## Compared to what else is out there

We ran the same original benchmark against Snyk Agent Scan (the tool most people know as mcp-scan). It couldn't render a verdict on any of the 18 files, for three separate reasons: it doesn't parse markdown rule files at all, its schema doesn't cover permissions or hooks, and reaching an actual verdict on MCP server configs requires a cloud account and running the servers themselves, neither of which RedFlag CI's own headless, zero-config design requires. The full comparison, including exactly what was tried and why, is in `backend/benchmark/COMPARISON.md`.

## v1.2.0: closing the gaps this document left open

v1.1.0's stress-testing pass found real limits and, per its own reasoning above, left some of them alone on purpose: three false positives recorded as accepted tradeoffs, plus one deliberate false negative carried over from the original 18-scenario benchmark and documented in `docs/adr/0001-deterministic-only-v1.md`. v1.2.0 went back to all four, plus three further gaps found the same way -- reading what the existing corpus already said was broken, not inventing new scenarios to chase -- and closed every one with a deterministic fix, not a smarter model. The ADR's second addendum makes the case for that choice directly: almost every gap the project's now-rejected LLM-tier plan was meant to close turned out to have one.

**The three accepted false positives, closed:**

- **Arg-reorder on an MCP server** (`near-miss-args-reorder`). DD-2 now compares flagged (`--key value`-style) arguments as an unordered set, leaving purely positional arguments order-sensitive, since a reorder there can still change execution semantics. `regression-dd2-positional-arg-reorder-fires` confirms the fix doesn't overcorrect: moving a positional argument alongside a flag reorder still fires.
- **A legitimate Cyrillic sentence tripping the homoglyph detector** (`near-miss-legit-cyrillic-text`). RF-2 gained a per-word script-majority check: a word that's mostly one non-Latin script reads as real language, not an attack; a word that's Latin except for one or two substituted characters still fires. `regression-rf2-greek-majority-legit` confirms the fix generalizes past Cyrillic to Greek.
- **An MCP server rename read as a brand-new entry** (`near-miss-mcp-server-rename`). A shared remove/add correlation utility now lets DD-1 recognize a paired rename by matching identity fields, instead of only ever comparing by key name. `regression-dd1-rename-args-whitespace` confirms the correlation is exact, not fuzzy: a trivial whitespace difference in an argument still breaks the match and correctly fires as new.

**The one deliberate false negative, closed:**

- **A homoglyph attack using an uncommon Cyrillic character went undetected** (`known-gap-uncommon-homoglyph`, U+0501). RF-2 now uses Unicode's official confusables.txt table instead of a hand-picked list. `regression-rf2-armenian-homoglyph` confirms the new table covers scripts well beyond the one code point that was originally missed.

**Three further fixes, not previously documented as known gaps but found reading the same corpus:**

- RF-1 gained the Combining Diacritical Marks block and the Unicode Tags block (U+E0000-U+E007F), closing two encoding gaps the original character-class table didn't cover (`regression-rf1-combining-mark-start`, `regression-rf1-unicode-tag-cursor-rules`).
- DD-1 now merges the `mcpServers` and `servers` schema keys instead of using `??`, which silently discarded `servers` any time `mcpServers` was present at all, even empty (`judgment-dd1-both-schema-keys-present`).
- DD-3's narrowing correlation, the same shared utility as DD-1's rename fix, generalizes past the two tool names it was originally verified against (`regression-dd3-narrowing-correlation`).

## Two more bugs, found by testing the fixes themselves

Building a regression fixture meant to confirm DD-2 correctly resolves a genuine collision between `mcpServers` and `servers` turned up that the fixture couldn't actually prove what it was built to prove: the bug and the fix produced the identical result on it, since the `mcpServers` side was unchanged either way and the fixture never actually needed `servers` to be read at all in order to pass. Looking closer found DD-2 had the exact `mcpServers ?? servers` short-circuit bug DD-1 had before its own schema-merge fix earlier in this same phase -- never ported over. Fixed with the same merge-with-precedence change, and a companion scenario, `regression-dd2-servers-key-blind-spot`, was built specifically to test what the first fixture couldn't: a `servers`-only entry with no collision to hide behind.

Separately, chasing why that fix's own source file rendered as a binary diff in git turned up a second, unrelated bug: a single stray NUL byte, embedded in the source since the original detector-hardening commit that introduced the line, sitting where a space belonged in an internal argument-comparison key. It never affected any finding -- both sides of every comparison built the identical corrupted string either way -- and, checked directly rather than assumed, it turned out the runtime string was never actually wrong either: TypeScript silently sanitizes a raw NUL inside a template literal into a space at compile time. Still a real defect in committed source, invisible to every text-based review tool until someone went looking at the raw bytes. Fixed directly, with a test that reads the source file's bytes, since a test of the runtime string alone -- the more obvious thing to check -- cannot catch this class of regression at all.

## The corpus, 120 to 138

Eighteen more scenarios, in three groups:

- **9 real-world-grounded scenarios**, sourced from actual incidents and documented techniques rather than only synthetic constructions: CVE-2025-54135 (a CurXecute-pattern MCP config rewrite), CVE-2025-54136 (MCPoison, a reverse-shell-shaped command swap on an already-approved server), the Trojan Source homoglyph pattern (CVE-2021-42574/42694) applied to an MCP server name, Riley Goodside's Unicode Tag Block invisible-instruction-injection technique, an eslint-scope-style base64-obfuscated curl-pipe-bash payload, an event-stream/colors.js-style unpinned npx dependency, a Capital One-pattern SSRF probe against a cloud metadata IP, a path-traversal sequence in a CLI argument, and a JSON duplicate-key smuggling case (pattern-inspired -- no single documented MCP incident, but a technique widely seen in WAF bypasses).
- **8 regression variants**, one for each Phase 1 through 4 gap closed above, built specifically to confirm each fix generalizes past the single scenario that originally found the gap, not just pass the one case it was written against.
- **1 more**, `regression-dd2-servers-key-blind-spot`, from the DD-2 bug found while building the regression variants themselves, above.

A perfect score on the resulting 138-scenario corpus is not a claim that detection is now complete. It's a claim that every gap this corpus was specifically built to test is closed, on the scenarios built to test it. The corpus grew because more of what it tests for was found; a future round that goes looking for the next thing it doesn't yet test for should expect to find something, the same way every round before it did -- that's the same caveat this document carried at 120 scenarios, not a new one added because the number happens to look clean this time.

## Where to look next

- `backend/benchmark/RESULTS.md` -- the full 138-scenario results table, generated fresh by the benchmark runner.
- `backend/benchmark/COMPARISON.md` -- the live comparison against Snyk Agent Scan.
- `docs/adr/0001-deterministic-only-v1.md` -- why v1 is deterministic-only, and the honest cost of that choice.
- `CHANGELOG.md` -- the exact fixes that shipped in v1.1.0 and v1.2.0.

This corpus isn't final. v2 (the project's last planned version, see `architecture.md` section 8) expands it further, with the same philosophy: hunt for real gaps deliberately, document what's found honestly, and don't stop once the numbers look clean.