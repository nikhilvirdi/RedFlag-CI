# ADR 0001: Deterministic-Only Detection for v1 (Precision Over Recall)

## Context

The research behind RedFlag CI's scope (`docs/PROBLEM_SPACE.md`) identifies two separate problems, and only one of them was allowed to drive v1's architecture.

The first is that agent configuration is a real, actively-exploited attack surface: CVE-2025-59536 (malicious Claude Code hooks), CVE-2025-54136 / MCPoison (silently repointing an already-approved MCP server), and independent research demonstrating invisible Unicode injected into rule files like `CLAUDE.md`. This part motivates building the tool at all.

The second problem is the one that actually shaped v1's design: noise. PROBLEM_SPACE.md documents that the dominant complaint across every AI code-review tool on the market is false positives, with reported rates "as high as 87% in some evaluations," and up to 40% of AI-generated review comments ignored outright regardless of correctness. Developer sentiment describes these tools as producing "pure noise" to the point of contradicting their own prior suggestions. The document is explicit about the consequence: "A tool that finds real issues but drowns them in false ones gets muted within a week, and the security benefit disappears along with it."

That single fact -- a noisy tool is a dead tool, regardless of what it can theoretically detect -- is why precision, not recall, is the binding constraint for v1. A design that catches more attack patterns but erodes trust faster than it builds it is a net loss under this project's own stated goals. Every other v1 decision (deterministic-only, fail-open, zero-config, stateless) is downstream of this one.

## Decision

v1 detects risky agent-config changes using six deterministic detectors only: no LLM calls, no ML models, no semantic or natural-language reasoning anywhere in the pipeline (architecture.md section 2). Every detector is a plain function that takes file content (and, for the diff-drift engine, a before/after pair) and returns a list of findings via fixed character-class checks, JSON structural comparisons, and set operations:

- **DD-1 through DD-4** (diff-drift engine): new MCP server added, pinned command/args/version swapped on an existing server (the MCPoison pattern), permission or allow-list widened, hook added or changed (the CVE-2025-59536 pattern).
- **RF-1 and RF-2** (rule-file engine): invisible/bidirectional-control Unicode characters, and a fixed table of Cyrillic/Greek characters that are visually identical to Latin ones.

This is stated in architecture.md section 2 as an explicit, named tradeoff, not an implementation shortcut to be upgraded later without comment: "RedFlag CI will miss cleverly obfuscated attacks that don't rely on invisible characters or an obvious permission change. That's an accepted tradeoff, not an oversight. A tool developers trust because it's quiet is more valuable than one that's thorough but gets muted after a week."

Determinism is also what makes v1's other properties possible: the tool is stateless (no database, no persisted baseline -- the base branch fetched fresh on every run is the only "memory" it needs), and its output is fully reproducible given the same two file versions. Neither property would hold if a detector's output depended on a model call.

## Consequences

Task 7.1 measured this decision against an 18-scenario synthetic benchmark (`backend/benchmark/corpus/`, results in `backend/benchmark/RESULTS.md`), covering all six detectors, four genuinely benign changes, five near-miss cases designed to stress false positives, and one case designed to stress a false negative. The corpus was built to surface real limits, not to look clean, and no detector logic was adjusted afterward to improve the numbers.

**Actual result: Precision = 0.727, Recall = 0.889** (8 true positives, 3 false positives, 6 true negatives, 1 false negative, out of 18 scenarios).

These are real numbers from a small, deliberately adversarial corpus, not a statistically representative sample of production traffic -- but they are the only empirical evidence this project currently has, and they say plainly that the precision-over-recall tradeoff has a measurable, non-trivial cost, not a hypothetical one.

### The three false positives, without minimizing them

**Arg-reorder on an MCP server (`near-miss-args-reorder`).** Two independent CLI flags on an already-approved server were reordered with no behavioral change; DD-2 flagged it as a definition change anyway. This traces to a deliberate design choice in `swappedMcpServer.ts`: array comparison is order-sensitive because a reorder of *positional* CLI arguments can change execution semantics, and the detector has no way to know whether a given argument is positional or an order-independent flag. The choice to treat all reorders as drift is defensible, but it does produce a real false positive on a real, benign refactor pattern.

**A legitimate Russian sentence triggering the homoglyph detector (`near-miss-legit-cyrillic-text`).** Adding one genuine, non-malicious sentence of Russian-language documentation to `CLAUDE.md` produced **nine separate RF-2 findings** in a single run -- one per matching Cyrillic letter. RF-2 is a pure character-class check with no natural-language awareness by design (architecture.md section 5: "no natural-language interpretation, no judgment calls"). It cannot distinguish a single homoglyph smuggled into otherwise-Latin text from an entire sentence legitimately written in Cyrillic, because at the character level those two things are identical. This is not an edge case that happens to exist somewhere in Unicode; it is the direct, structural consequence of how RF-2 works, and it will reproduce on any repository whose `CLAUDE.md`, `.cursor/rules/*`, or `copilot-instructions.md` contains legitimate non-Latin-script content -- localization notes, contributor names, translated examples.

**An MCP server rename triggering DD-1 (`near-miss-mcp-server-rename`).** Renaming an existing server's key while leaving its command and args byte-for-byte identical was flagged as a brand-new, unreviewed server. DD-1 diffs purely by key name (per its spec: "any entry present in head but absent from base is a finding"), so it structurally cannot distinguish a rename of a trusted entry from a genuinely new one.

None of these three are bugs in the sense that the code fails to do what it was built to do -- each detector is working exactly as specified. They are the visible cost of choosing simple, explainable, deterministic comparisons over anything that could reason about intent.

### The one deliberate false negative

**A homoglyph attack using Cyrillic U+0501 (`ԁ`, resembling Latin `d`) went undetected (`known-gap-uncommon-homoglyph`).** RF-2's confusable table covers a well-documented but explicitly non-exhaustive set of look-alike characters (architecture.md section 5 calls RF-2's set "well-documented Cyrillic and Greek characters," not "all Unicode confusables"). U+0501 isn't in that table, so a real homoglyph substitution using it passes through silently. This is precisely the tradeoff architecture.md section 2 names up front -- "RedFlag CI will miss cleverly obfuscated attacks that don't rely on invisible characters or an obvious permission change" -- made concrete with an actual missed attack rather than a hypothetical one.

### A claim in architecture.md that this benchmark shows needs qualifying

Architecture.md section 5 states that RF-1 and RF-2 "carry a near-zero false-positive rate" because they are pure character-class checks with no judgment calls. That reasoning is sound for RF-1: invisible and bidirectional-control characters genuinely have no legitimate reason to appear in a markdown instruction file, so its 0-of-4 false-positive record in this benchmark (0 misfires across 4 negative scenarios, including a byte-order-mark near-miss) is not a coincidence.

It does not hold for RF-2. The `near-miss-legit-cyrillic-text` result -- one legitimate sentence producing nine findings -- demonstrates that RF-2's false-positive rate is a direct function of how much legitimate non-Latin-script content a repository's rule files contain, and for any repo with real multilingual documentation, that rate is not near zero. This ADR states that plainly rather than repeating architecture.md's blanket claim uncritically: **the "near-zero false-positive rate" claim in architecture.md section 5 needs to be scoped to RF-1, or reworded to acknowledge RF-2's exposure to legitimate multilingual content, the next time that section is revised.**

## Alternatives considered

**Add LLM- or ML-based semantic checking now, in v1, to close the recall gap.** Rejected. The missed `known-gap-uncommon-homoglyph` attack is a real example of the kind of thing a semantic or fuzzy-matching check could plausibly catch (any Cyrillic/Greek-adjacent character substituted into an English word, not just the ones in a fixed table). But adding that now means reintroducing exactly the noise problem PROBLEM_SPACE.md identifies as the industry's dominant failure mode, plus non-determinism, external API latency and cost, and a dependency the user doesn't control -- all in direct conflict with v1's zero-config, stateless, "quiet by default" design principles. This is precisely why architecture.md section 8 defers this capability to v2 as an *opt-in* adjudication tier, off by default, using a key the user supplies themselves, escalating only "genuinely ambiguous findings" rather than replacing v1's deterministic pass. The `known-gap-uncommon-homoglyph` result is the concrete evidence for why v2 exists, not a reason to pull it into v1 early.

**Expand RF-2's confusable table to close specific gaps like U+0501, without adding an LLM.** Considered as a smaller, still-deterministic mitigation, and worth doing as ordinary detector maintenance -- it doesn't conflict with any v1 design principle. It was not done as part of this task, since Task 7.1's scope was measurement, not fixes, and because a larger table doesn't change the *other* finding here: it would not fix the `near-miss-legit-cyrillic-text` false positive, and arguably makes it worse, since a broader confusable table means more legitimate non-Latin text falls into it. The recall gap and the precision gap on RF-2 pull in opposite directions on the same lever; that tension itself is worth flagging for whoever scopes the table's next revision.

**Add repo-level context awareness (e.g., suppress RF-2 in repos with declared non-English content).** Would address the multilingual false positive directly, but requires configuration -- a settings screen, a declared-languages field, or similar -- which architecture.md section 9 rules out for v1 ("No dashboard or UI of any kind in v1") and which conflicts with the "zero-config, install it and it works" principle in section 2. Not pursued for v1; a candidate for v3 or v4 if broader per-repo configuration is ever introduced.

**Do nothing and let architecture.md's "near-zero false-positive rate" claim for RF-2 stand unqualified.** Rejected as a documentation choice, independent of any code change. This ADR exists partly to correct that: the credibility of a project whose entire premise is "unlike everyone else, we're honest about our false-positive rate" depends on not repeating a claim its own benchmark contradicts.

## Status

Accepted, for v1. The three false-positive patterns and the one false-negative pattern documented above are recorded as known, accepted limitations of a deliberate design choice -- not as bugs to be silently patched to make a future benchmark run look better. Any change that measurably improves one of these numbers should be evaluated against whether it reintroduces the noise this decision exists to avoid, per the same standard applied here.

This decision was originally written expecting to be superseded in scope, not overridden, once an opt-in LLM adjudication tier shipped in a later version. That tier was reconsidered and rejected before being built -- see the addendum below for why. This ADR's reasoning is this project's permanent position, not a placeholder pending a future upgrade.

## Addendum: benchmark expansion and fixes (2026-08-06)

The 18-scenario corpus above was the first measurement of this decision, not the last. Before considering v1 ready to rely on, the corpus grew to 120 scenarios across six rounds of deliberate stress-testing, aimed specifically at finding edge cases the original 18 didn't cover: deeper per-detector coverage, explicit judgment calls, fail-open behavior under malformed input, realistic scale, unusual character encodings, multiple detectors colliding on one change, and adversarial evasion attempts.

That expansion did its job. It surfaced one real detector defect during construction -- DD-3's wildcard-escalation check was a plain substring match, so it flagged any permission containing a literal asterisk as an unrestricted grant, including narrow, legitimate glob-scoped paths like `Read(src/**)`. That was fixed immediately, since it was a genuine bug rather than a documented tradeoff. Once the full 120-scenario run was complete, it also surfaced five further gaps, none of them bugs in the sense of the code failing its own spec, but real, fixable limits worth closing anyway:

- RF-1 was missing two invisible characters with no legitimate reason to appear in an instruction file: the soft hyphen and the standalone right-to-left mark.
- RF-2's confusable table didn't cover fullwidth Latin letters, mathematical alphanumeric symbols, Armenian, or Cherokee -- four entire scripts of Latin look-alikes.
- DD-2 compared command, arguments, and version, but not environment variables, even though an env-var swap carries the same MCPoison-shaped risk as a command swap.
- DD-3 recognized `Bash(*)` as an unrestricted grant but not the equally broad `Bash` with no arguments at all, since that shape contains no literal asterisk.
- DD-4 had no whitespace normalization on hook-command comparison, and never compared a hook's matcher/trigger scope, only its command.

All five were fixed, each verified individually against the specific scenario that found it, with the rest of the test suite confirmed unaffected. `architecture.md` section 5 was updated to reflect DD-2's and DD-4's expanded scope. Re-running the full 120-scenario corpus afterward: **precision rose to 0.926, recall to 0.949** (see `backend/benchmark/RESULTS.md`).

What this addendum does not claim: the three false positives and one false negative documented above, in the original 18-scenario run, are unchanged. The arg-reorder, legitimate-Cyrillic-text, and server-rename false positives are still there, for the same structural reasons already given -- fixing them would mean DD-1/DD-2 correlating removals with additions, or RF-2 gaining natural-language awareness, both of which remain the kind of judgment call this decision keeps out of v1's deterministic detectors. The RF-2 qualification to architecture.md's "near-zero false-positive rate" claim, above, also still stands; it was not addressed by this round and remains open for whoever next revises that section.

## Addendum: the roadmap's LLM tier was reconsidered and rejected, not built (2026-08-07)

architecture.md's original section 8 planned four major versions, with v2 as an opt-in, BYOK LLM adjudication tier meant to close exactly the kind of gap this ADR documents above: the uncommon-homoglyph false negative and the legitimate-multilingual-text false positive. Before that tier was scoped or built, the plan was revisited directly against this ADR's own findings, and rejected, for reasons consistent with everything already argued above rather than in tension with it:

- **Almost every gap the LLM tier was meant to close turned out to have a deterministic fix instead.** The uncommon-homoglyph miss closes by adopting Unicode's official confusables table in place of the hand-picked one -- a bigger, standard table instead of a smarter model. The legitimate-Cyrillic-text false positive closes with a per-word script-majority heuristic: a word that's mostly one non-Latin script is treated as real language, and a word that's Latin except for one substituted character is treated as a probable attack. Both fixes are scoped into v1.2.0 (see `workplan.md`), and both stay explainable in the same way every existing detector already is: the finding can be traced to a specific rule, not a model's confidence score.
- **A custom-trained ML model was considered as a lighter-weight alternative to a full LLM tier, and rejected for the same underlying reason.** It would still trade an explainable rule for a statistical judgment, still requires a labeled training set this project doesn't have (the 120-scenario benchmark is a test set, not remotely enough to train on), and still reopens the "why did it flag this" problem RF-1 and RF-2 currently don't have.
- **The remaining gap that isn't closeable this way is cross-PR gradual drift.** This was always a memory problem, not something an LLM tier would have solved either. It's addressed in v2 instead, with a lightweight git-native baseline snapshot -- not persistence at the scale originally planned for v3, and not any form of AI.

The net effect: v2 no longer means what architecture.md's original section 8 said it meant. Full detail on the revised roadmap, including what else was cut (Postgres persistence, MCP behavioral scanning, auto-fix PRs, a hosted dashboard) and what survived in a lighter form (SARIF/JSON export, folded into v2 Phase B), lives in architecture.md section 8. This ADR's core position is unchanged and, if anything, more firmly established by this review than it was at v1.0.0: RedFlag CI's deterministic-only design is this project's permanent architecture, not a v1-only starting point waiting to be upgraded.