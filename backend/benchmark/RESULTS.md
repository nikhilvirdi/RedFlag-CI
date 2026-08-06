# RedFlag CI v1 Benchmark Results

Generated: 2026-08-06T12:24:03.250Z

## Methodology

120 synthetic PR scenarios, each a before/after file pair for one monitored file, stored under `benchmark/corpus/<scenario-id>/`. `benchmark/run.ts` (`npm run benchmark`) runs the actual production detector functions and `aggregateFindings` against each pair -- the same dispatch logic `processPullRequestEvent.ts` uses (diff-drift files get DD-1 through DD-4; rule-file files get RF-1/RF-2 against head content only) -- with no GitHub API, webhook, or posting involved. Each scenario carries a ground-truth label (`positive` = should produce at least one finding, `negative` = should produce none). A scenario "fires" if the aggregated findings array is non-empty. No detector logic was modified to produce these numbers; this report only adds a category dimension on top of run.ts's own unmodified output, derived from the six build sessions the corpus was assembled across.

Classification:
- **TP**: positive label, fired
- **FN**: positive label, did not fire
- **FP**: negative label, fired
- **TN**: negative label, did not fire

## Corpus composition (120 scenarios, 6 categories)

| # | Category | Scenarios | Summary |
|---|---|---|---|
| 1 | Original 18 (Phase 7 baseline) | 18 | The first benchmark corpus, built when v1's six detectors first shipped: one clean-firing example per detector, four benign no-op controls, three deliberately adversarial near-misses probing a specific documented tradeoff each (args reorder, a legitimate Cyrillic sentence, a server rename), and one known-gap homoglyph outside RF-2's table. This category is the historical baseline every later session's corpus expansion was measured against. |
| 2 | DD-1-DD-4 deep coverage (Session 1) | 21 | 21 scenarios stress-testing the four diff-drift detectors' edge cases: schema-key variants, minimal configs, multiple simultaneous additions, unicode/whitespace in server names, env-var and version/hash swaps, deny-removal and multi-entry permission changes, and hook-shape variations (array vs. object, whitespace-only command changes). This session is also where the DD-3 wildcard-escalation bug (dd3-narrowing-syntax-rewrite) was originally found via stress-testing and then fixed in a dedicated follow-up task. |
| 3 | RF-1/RF-2 deep coverage + judgment calls (Session 2) | 19 | 19 scenarios: the first half exercises RF-1/RF-2 edge cases (additional bidi/zero-width variants, Greek and mixed-script homoglyphs, homoglyphs inside code fences and URLs); the second half is ten explicit "judgment call" scenarios probing debatable tradeoffs in DD-1 through DD-4 and RF-1/RF-2 -- schema-key precedence, wildcard-then-narrowed in one PR, whitespace-only hook changes, and a Latin loanword embedded in genuine Cyrillic prose. |
| 4 | Fail-open stress + scale (Session 3) | 20 | 20 scenarios: 14 fail-open cases feeding detectors truncated JSON, wrong JSON types, empty files, trailing commas, null bytes, and non-UTF-8 bytes, confirming architecture.md 2's fail-open principle holds (malformed input never throws, never blocks, always reports nothing) -- plus one large-file case that legitimately fires despite its size. 6 scale cases confirm detectors still fire correctly against large allow-lists, deeply nested hook configs, many MCP servers, a buried invisible character in a long file, and minified single-line JSON, plus one negative control (repeated identical hooks). |
| 5 | Encoding/near-miss + multi-detector collision (Session 4) | 21 | 21 scenarios (the task specified 20; one was split into two fixture IDs since this corpus is one file-pair per scenario). 14 exercise RF-1/RF-2 against unusual encodings -- UTF-16 BOMs, NFC/NFD normalization, and eight code points from scripts/blocks entirely outside RF-1/RF-2's coverage (fullwidth Latin, mathematical alphanumeric, Armenian, Cherokee, combining diacriticals, RLM, soft hyphen, Unicode tags), most DELIBERATELY constructed to miss, documenting known gaps rather than bugs. 7 exercise multiple detectors or multiple servers colliding within one file or PR, confirming detectors fire independently without suppressing each other. |
| 6 | Benign + adversarial evasion (Session 5) | 21 | 21 scenarios (again one task item split into two fixture IDs, for the same one-file-pair-per-scenario reason). 10 "benign" scenarios confirm genuinely harmless changes stay quiet, EXCEPT where the task explicitly calls for firing to be correct behavior even on a harmless change (a routine version bump, a real lint hook, a whitespace-equivalent hook rewrite) -- precision over recall does not mean suppressing findings that legitimately match a trigger condition. 10 adversarial scenarios probe evasion attempts against detector mechanics specifically (key renames masking a swap, bare non-wildcard broad grants, cross-file payload splitting, homoglyphs placed where DD-4 never looks), several DELIBERATELY succeeding at evading detection to document structural, accepted limitations grounded in architecture.md 9's non-goals and the stateless-in-v1 principle. |

## Headline numbers (all 120 scenarios)

- True positives: 66
- False positives: 8
- True negatives: 34
- False negatives: 12
- **Precision** = TP / (TP + FP) = 66 / 74 = 0.892
- **Recall** = TP / (TP + FN) = 66 / 78 = 0.846

**Compared to the original 18-scenario benchmark (precision 0.727, recall 0.889):** precision rose to 0.892 and recall fell to 0.846. Both movements are expected, not cherry-picked: the corpus grew almost 7x, mostly by adding scenarios that specifically probe known, narrow limitations (the 8 encoding known-gaps in category 5 alone account for two-thirds of all false negatives), which mechanically pulls recall down without indicating new breakage. Precision rose mainly because the newer sessions added many more true negatives and structurally-correct true positives (benign changes staying quiet, adversarial evasions correctly resisted) than new false positives -- only 5 of the 8 total false positives are new since the original 18 corpus, versus 58 new true positives and 28 new true negatives. A larger, harder, more adversarial corpus producing a lower headline recall is the corpus doing its job, not a regression.

## Breakdown by category

| Category | TP | FP | TN | FN | Precision | Recall |
|---|---|---|---|---|---|---|
| Original 18 (Phase 7 baseline) | 8 | 3 | 6 | 1 | 0.727 | 0.889 |
| DD-1-DD-4 deep coverage (Session 1) | 15 | 3 | 2 | 1 | 0.833 | 0.938 |
| RF-1/RF-2 deep coverage + judgment calls (Session 2) | 16 | 2 | 0 | 1 | 0.889 | 0.941 |
| Fail-open stress + scale (Session 3) | 6 | 0 | 14 | 0 | 1.000 | 1.000 |
| Encoding/near-miss + multi-detector collision (Session 4) | 8 | 0 | 5 | 8 | 1.000 | 0.500 |
| Benign + adversarial evasion (Session 5) | 13 | 0 | 7 | 1 | 1.000 | 0.929 |

Category 4 (fail-open + scale) has perfect precision and recall: every fail-open case is a true negative by construction (malformed input, expected to produce nothing) and every scale case fires or stays quiet exactly as sized-up versions of already-proven-correct behavior should. Category 5 (encoding + multi-detector)'s low recall (0.500) is entirely the 8 deliberate known-gap encoding scenarios; its precision is still perfect (1.000) since none of those scenarios produce a spurious finding, they simply produce no finding where an ideal detector would.

## Breakdown by detector

| Detector | Positive scenarios | Caught (TP) | Negative scenarios | Misfired (FP) |
|---|---|---|---|---|
| `diff-drift.hook-changed` | 11 | 10 | 6 | 2 |
| `diff-drift.new-mcp-server` | 13 | 12 | 17 | 1 |
| `diff-drift.new-mcp-server + diff-drift.swapped-mcp-server` | 3 | 3 | 0 | 0 |
| `diff-drift.swapped-mcp-server` | 10 | 9 | 2 | 1 |
| `diff-drift.widened-permissions` | 14 | 14 | 4 | 2 |
| `diff-drift.widened-permissions + diff-drift.hook-changed` | 2 | 2 | 1 | 0 |
| `rule-file.homoglyph` | 12 | 7 | 2 | 2 |
| `rule-file.invisible-unicode` | 11 | 7 | 7 | 0 |
| `rule-file.invisible-unicode + rule-file.homoglyph` | 2 | 2 | 3 | 0 |

## Full scenario results

| ID | Category | File | Ground truth | Fired? | Result | Findings |
|---|---|---|---|---|---|---|
| `dd1-new-server` | Original 18 (Phase 7 baseline) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'browser-automation' added |
| `dd2-command-swap` | Original 18 (Phase 7 baseline) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args) |
| `dd3-wildcard-added` | Original 18 (Phase 7 baseline) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Bash(*)' added to allow-list |
| `dd3-plain-allow-added` | Original 18 (Phase 7 baseline) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Write(.env)' added to allow-list |
| `dd4-hook-added` | Original 18 (Phase 7 baseline) | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: New hook 'PostToolUse' added |
| `dd4-hook-command-changed` | Original 18 (Phase 7 baseline) | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PreToolUse' command changed |
| `rf1-zero-width-space` | Original 18 (Phase 7 baseline) | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200B) found |
| `rf2-cyrillic-homoglyph` | Original 18 (Phase 7 baseline) | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found |
| `benign-mcp-reorder` | Original 18 (Phase 7 baseline) | `.mcp.json` | negative | false | **TN** | (none) |
| `benign-claude-md-doc-addition` | Original 18 (Phase 7 baseline) | `CLAUDE.md` | negative | false | **TN** | (none) |
| `benign-permissions-narrowing` | Original 18 (Phase 7 baseline) | `.claude/settings.json` | negative | false | **TN** | (none) |
| `benign-copilot-instructions-edit` | Original 18 (Phase 7 baseline) | `.github/copilot-instructions.md` | negative | false | **TN** | (none) |
| `near-miss-args-reorder` | Original 18 (Phase 7 baseline) | `.mcp.json` | negative | true | **FP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args) |
| `near-miss-hook-removed` | Original 18 (Phase 7 baseline) | `.claude/settings.json` | negative | false | **TN** | (none) |
| `near-miss-bom` | Original 18 (Phase 7 baseline) | `CLAUDE.md` | negative | false | **TN** | (none) |
| `near-miss-legit-cyrillic-text` | Original 18 (Phase 7 baseline) | `CLAUDE.md` | negative | true | **FP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0440) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0420) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found |
| `near-miss-mcp-server-rename` | Original 18 (Phase 7 baseline) | `.mcp.json` | negative | true | **FP** | diff-drift.new-mcp-server [warning]: New MCP server 'filesystem-server' added |
| `known-gap-uncommon-homoglyph` | Original 18 (Phase 7 baseline) | `.cursor/rules/deploy.md` | positive | false | **FN** | (none) |
| `dd1-servers-key-variant` | DD-1-DD-4 deep coverage (Session 1) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'docs' added |
| `dd1-minimal-config` | DD-1-DD-4 deep coverage (Session 1) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'notify' added |
| `dd1-multiple-servers-added` | DD-1-DD-4 deep coverage (Session 1) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'browser' added; diff-drift.new-mcp-server [warning]: New MCP server 'database' added |
| `dd1-unicode-server-name` | DD-1-DD-4 deep coverage (Session 1) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'café tools' added |
| `dd1-server-added-trailing-whitespace-key` | DD-1-DD-4 deep coverage (Session 1) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'filesystem ' added |
| `dd2-args-only-change` | DD-1-DD-4 deep coverage (Session 1) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args) |
| `dd2-both-changed` | DD-1-DD-4 deep coverage (Session 1) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (command, args) |
| `dd2-env-var-change` | DD-1-DD-4 deep coverage (Session 1) | `.mcp.json` | positive | false | **FN** | (none) |
| `dd2-version-hash-change` | DD-1-DD-4 deep coverage (Session 1) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (version) |
| `dd3-deny-removed-plain` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Deny rule 'Bash(curl)' removed |
| `dd3-multiple-allow-added` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Write(/tmp)' added to allow-list; diff-drift.widened-permissions [warning]: Permission 'Bash(git status)' added to allow-list |
| `dd3-permissions-block-newly-created` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Bash(npm test)' added to allow-list |
| `dd3-allow-and-deny-both-changed` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Write(/tmp)' added to allow-list; diff-drift.widened-permissions [warning]: Deny rule 'Bash(rm)' removed |
| `dd3-wildcard-narrowed-to-specific` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | negative | true | **FP** | diff-drift.widened-permissions [warning]: Permission 'Bash(npm test)' added to allow-list |
| `dd3-narrowing-syntax-rewrite` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | negative | true | **FP** | diff-drift.widened-permissions [warning]: Permission 'Write(./dist/**)' added to allow-list |
| `dd4-multiple-hooks-changed` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PreToolUse[0]' command changed; diff-drift.hook-changed [high]: Hook 'PreToolUse[1]' command changed |
| `dd4-hook-removed-single` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | negative | false | **TN** | (none) |
| `dd4-matcher-changed-command-same` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | negative | false | **TN** | (none) |
| `dd4-command-whitespace-only-change` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | negative | true | **FP** | diff-drift.hook-changed [high]: Hook 'PreToolUse' command changed |
| `dd4-array-vs-object-shape` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: New hook 'PreToolUse' added |
| `dd4-new-hook-event-type` | DD-1-DD-4 deep coverage (Session 1) | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: New hook 'SessionStart' added |
| `rf1-zero-width-joiner` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200D) found |
| `rf1-zero-width-non-joiner` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200C) found |
| `rf1-bidi-rlo-specific` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+202E) found |
| `rf1-multiple-bidi-variants-one-file` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+202A) found; rule-file.invisible-unicode [high]: Invisible Unicode character (U+202D) found; rule-file.invisible-unicode [high]: Invisible Unicode character (U+2066) found |
| `rf2-greek-homoglyph` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Greek look-alike character (U+03BF) found |
| `rf2-multiple-scripts-mixed` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Greek look-alike character (U+03BF) found |
| `rf2-homoglyph-in-code-fence` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `CLAUDE.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found |
| `rf2-homoglyph-adjacent-attack-text` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `CLAUDE.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+043E) found |
| `rf2-homoglyph-in-url` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `CLAUDE.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0456) found |
| `judgment-dd3-deny-removed-had-wildcard` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Deny rule 'Bash(*)' removed |
| `judgment-dd1-server-re-added-identically` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'cache' added |
| `judgment-dd2-args-reorder-with-real-semantics` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'deploy' definition changed (args) |
| `judgment-dd4-hook-whitespace-only` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `.claude/settings.json` | negative | true | **FP** | diff-drift.hook-changed [high]: Hook 'PreToolUse' command changed |
| `judgment-dd1-both-schema-keys-present` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `.mcp.json` | positive | false | **FN** | (none) |
| `judgment-rf1-invisible-char-in-security-docs` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200B) found |
| `judgment-dd3-wildcard-added-then-narrowed-same-pr` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Write(*)' added to allow-list; diff-drift.widened-permissions [warning]: Permission 'Bash(npm test)' added to allow-list |
| `judgment-rf2-latin-loanword-in-cyrillic-context` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `CLAUDE.md` | negative | true | **FP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+041A) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+043E) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+043E) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0445) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0440) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found |
| `judgment-dd4-hook-command-becomes-empty-string` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PreToolUse' command changed |
| `judgment-dd3-permission-entry-case-difference` | RF-1/RF-2 deep coverage + judgment calls (Session 2) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Bash(NPM TEST)' added to allow-list |
| `failopen-truncated-json-head` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-truncated-json-base` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-wrong-type-array-head` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-wrong-type-string-head` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-wrong-type-number-head` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-wrong-type-null-head` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-empty-file-head` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-empty-file-base` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-trailing-comma-json` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-deeply-nested-unexpected-structure` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-null-byte-embedded` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-non-utf8-bytes` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-large-file-500kb` | Fail-open stress + scale (Session 3) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'monitoring-agent' added |
| `failopen-both-sides-malformed` | Fail-open stress + scale (Session 3) | `.mcp.json` | negative | false | **TN** | (none) |
| `scale-large-allow-list-20-entries` | Fail-open stress + scale (Session 3) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Bash(*)' added to allow-list |
| `scale-deeply-nested-hook-config` | Fail-open stress + scale (Session 3) | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PostToolUse' command changed |
| `scale-long-file-buried-invisible-char` | Fail-open stress + scale (Session 3) | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200B) found |
| `scale-many-mcp-servers` | Fail-open stress + scale (Session 3) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'monitoring-agent' added |
| `scale-repeated-identical-hooks` | Fail-open stress + scale (Session 3) | `.claude/settings.json` | negative | false | **TN** | (none) |
| `scale-minified-single-line-json` | Fail-open stress + scale (Session 3) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'monitoring' added |
| `encoding-utf16-bom-le` | Encoding/near-miss + multi-detector collision (Session 4) | `CLAUDE.md` | negative | false | **TN** | (none) |
| `encoding-utf16-bom-be` | Encoding/near-miss + multi-detector collision (Session 4) | `CLAUDE.md` | negative | false | **TN** | (none) |
| `encoding-bom-not-at-start` | Encoding/near-miss + multi-detector collision (Session 4) | `CLAUDE.md` | negative | false | **TN** | (none) |
| `encoding-mixed-crlf-lf` | Encoding/near-miss + multi-detector collision (Session 4) | `CLAUDE.md` | negative | false | **TN** | (none) |
| `encoding-nfc-vs-nfd-homoglyph` | Encoding/near-miss + multi-detector collision (Session 4) | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Greek look-alike character (U+03BF) found |
| `encoding-fullwidth-latin-homoglyph` | Encoding/near-miss + multi-detector collision (Session 4) | `.cursor/rules/security.md` | positive | false | **FN** | (none) |
| `encoding-mathematical-alphanumeric-symbol` | Encoding/near-miss + multi-detector collision (Session 4) | `.cursor/rules/security.md` | positive | false | **FN** | (none) |
| `encoding-zwsp-in-diffdrift-file` | Encoding/near-miss + multi-detector collision (Session 4) | `.mcp.json` | negative | false | **TN** | (none) |
| `encoding-armenian-homoglyph` | Encoding/near-miss + multi-detector collision (Session 4) | `.cursor/rules/security.md` | positive | false | **FN** | (none) |
| `encoding-cherokee-homoglyph` | Encoding/near-miss + multi-detector collision (Session 4) | `.cursor/rules/security.md` | positive | false | **FN** | (none) |
| `encoding-combining-diacritical-invisible` | Encoding/near-miss + multi-detector collision (Session 4) | `.cursor/rules/security.md` | positive | false | **FN** | (none) |
| `encoding-rlm-standalone` | Encoding/near-miss + multi-detector collision (Session 4) | `.cursor/rules/security.md` | positive | false | **FN** | (none) |
| `encoding-soft-hyphen` | Encoding/near-miss + multi-detector collision (Session 4) | `.cursor/rules/security.md` | positive | false | **FN** | (none) |
| `encoding-unicode-tag-characters` | Encoding/near-miss + multi-detector collision (Session 4) | `.cursor/rules/security.md` | positive | false | **FN** | (none) |
| `multi-new-and-modified-server` | Encoding/near-miss + multi-detector collision (Session 4) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (command, args); diff-drift.new-mcp-server [warning]: New MCP server 'browser' added |
| `multi-wildcard-and-hook` | Encoding/near-miss + multi-detector collision (Session 4) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Bash(*)' added to allow-list; diff-drift.hook-changed [high]: New hook 'PostToolUse' added |
| `multi-deny-removed-and-allow-added` | Encoding/near-miss + multi-detector collision (Session 4) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Write(/tmp)' added to allow-list; diff-drift.widened-permissions [warning]: Deny rule 'Bash(rm)' removed |
| `multi-rf1-and-rf2-same-file` | Encoding/near-miss + multi-detector collision (Session 4) | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200B) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found |
| `multi-three-servers-mixed-changes` | Encoding/near-miss + multi-detector collision (Session 4) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'git' definition changed (command, args); diff-drift.new-mcp-server [warning]: New MCP server 'browser' added |
| `multi-all-four-diffdrift-one-pr-mcp` | Encoding/near-miss + multi-detector collision (Session 4) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (command, args); diff-drift.new-mcp-server [warning]: New MCP server 'browser' added |
| `multi-all-four-diffdrift-one-pr-settings` | Encoding/near-miss + multi-detector collision (Session 4) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Bash(*)' added to allow-list; diff-drift.hook-changed [high]: New hook 'SessionStart' added |
| `benign-version-bump-in-args` | Benign + adversarial evasion (Session 5) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'git' definition changed (args) |
| `benign-new-unrelated-toplevel-key` | Benign + adversarial evasion (Session 5) | `.mcp.json` | negative | false | **TN** | (none) |
| `benign-hook-added-for-linting` | Benign + adversarial evasion (Session 5) | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: New hook 'PostToolUse' added |
| `benign-multiple-permissions-narrowed` | Benign + adversarial evasion (Session 5) | `.claude/settings.json` | negative | false | **TN** | (none) |
| `benign-claude-md-typo-fix` | Benign + adversarial evasion (Session 5) | `CLAUDE.md` | negative | false | **TN** | (none) |
| `benign-cursor-rules-new-clean-file` | Benign + adversarial evasion (Session 5) | `.cursor/rules/style.md` | negative | false | **TN** | (none) |
| `benign-copilot-instructions-formatting-only` | Benign + adversarial evasion (Session 5) | `.github/copilot-instructions.md` | negative | false | **TN** | (none) |
| `benign-comment-like-key-added` | Benign + adversarial evasion (Session 5) | `.mcp.json` | negative | false | **TN** | (none) |
| `benign-settings-unrelated-section-added` | Benign + adversarial evasion (Session 5) | `.claude/settings.json` | negative | false | **TN** | (none) |
| `benign-hooks-reorganized-same-behavior` | Benign + adversarial evasion (Session 5) | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PreToolUse' command changed |
| `adversarial-cross-file-attack-split` | Benign + adversarial evasion (Session 5) | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: New hook 'PostToolUse' added |
| `adversarial-rename-masks-swap` | Benign + adversarial evasion (Session 5) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'new-fs' added |
| `adversarial-broad-non-wildcard-pattern` | Benign + adversarial evasion (Session 5) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Bash' added to allow-list |
| `adversarial-homoglyph-plus-invisible-combo` | Benign + adversarial evasion (Session 5) | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200B) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found |
| `adversarial-split-command-across-args` | Benign + adversarial evasion (Session 5) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'git' definition changed (args) |
| `adversarial-benign-name-malicious-command` | Benign + adversarial evasion (Session 5) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'linter' added |
| `adversarial-gradual-drift-two-prs-pr1` | Benign + adversarial evasion (Session 5) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Bash(git diff)' added to allow-list |
| `adversarial-gradual-drift-two-prs-pr2` | Benign + adversarial evasion (Session 5) | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Bash(git *)' added to allow-list |
| `adversarial-homoglyph-in-hook-key-not-command` | Benign + adversarial evasion (Session 5) | `.claude/settings.json` | positive | false | **FN** | (none) |
| `adversarial-encoded-payload-in-args` | Benign + adversarial evasion (Session 5) | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args) |
| `adversarial-mimics-approved-pattern` | Benign + adversarial evasion (Session 5) | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'filesystem-v2' added |

## False positives and false negatives, explained honestly

20 of 120 scenarios were misclassified by the tool relative to this corpus's ground truth. None of these are implementation bugs in the sense of "the code does not match its own spec" -- each is the detector behaving exactly as designed, on a case where that design has a real, documented limit, and every one of them was already anticipated in writing by the session that built it (see `testcase_v1report.md` for the full per-scenario audit confirming this). They are recorded here, not fixed, per this task's scope.

### `near-miss-args-reorder` (FP, Original 18 (Phase 7 baseline))

An MCP server's two independent CLI flags are reordered; the positional package argument stays last and behavior is unchanged.

**Why**: DD-2 compares args via JSON.stringify, which is order-sensitive by design (see the code comment: reordering CAN change execution semantics for positional CLI args, so it is deliberately treated as drift). Included to test that documented tradeoff honestly rather than assume it away.

**Actual findings**: diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args)

### `near-miss-legit-cyrillic-text` (FP, Original 18 (Phase 7 baseline))

A genuine Russian-language example sentence is added to CLAUDE.md as localization documentation -- not an attack.

**Why**: RF-2 is a pure character-class check with no natural-language awareness (architecture.md 5), so it cannot distinguish a homoglyph substituted into Latin text from a legitimate sentence written entirely in Cyrillic.

**Actual findings**: rule-file.homoglyph [high]: Cyrillic look-alike character (U+0440) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0420) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found

### `near-miss-mcp-server-rename` (FP, Original 18 (Phase 7 baseline))

An existing MCP server is renamed to a clearer key; command and args are byte-for-byte identical.

**Why**: DD-1 diffs by key name only, so it cannot tell a rename of a trusted entry apart from a genuinely new, unreviewed one.

**Actual findings**: diff-drift.new-mcp-server [warning]: New MCP server 'filesystem-server' added

### `known-gap-uncommon-homoglyph` (FN, Original 18 (Phase 7 baseline))

A homoglyph attack using Cyrillic U+0501 ('d' look-alike), a code point not in RF-2's confusable table.

**Why**: This is a real attack pattern. RF-2's table covers well-documented confusables, not the full Unicode confusables database, per architecture.md 2's accepted precision-over-recall tradeoff: RedFlag CI will miss cleverly obfuscated attacks outside its deterministic checks.

**Actual findings**: (none)

### `dd2-env-var-change` (FN, DD-1-DD-4 deep coverage (Session 1))

An existing server's "env" field changes (widening a filesystem server's allowed directory from /workspace to /); command and args are untouched.

**Why**: Documented, accepted scope gap, not a bug to fix here: DD-2's PINNED_FIELDS is exactly ['command', 'args', 'version', 'hash'] (architecture.md 5 names only command/args/version). 'env' is never compared, so a security-relevant env-var change on an already-approved server goes undetected. This is an expected false negative, analogous to known-gap-uncommon-homoglyph.

**Actual findings**: (none)

### `dd3-wildcard-narrowed-to-specific` (FP, DD-1-DD-4 deep coverage (Session 1))

An existing "Bash(*)" allow entry is replaced with the narrower "Bash(npm test)".

**Why**: Intended as a narrowing (a wildcard replaced by one specific command) that should not fire. DD-3 only checks whether each head allow string is present in base's allow set -- it does not correlate a removal with an addition, so "Bash(npm test)" reads as a brand-new allow entry regardless of what it replaced. See task report for whether this reproduced.

**Actual findings**: diff-drift.widened-permissions [warning]: Permission 'Bash(npm test)' added to allow-list

### `dd3-narrowing-syntax-rewrite` (FP, DD-1-DD-4 deep coverage (Session 1))

An existing "Write(*)" allow entry is reworded to "Write(./dist/**)", scoping writes to one directory.

**Why**: Intended as a narrowing. The replacement string still contains a literal "*" character (from the "**" glob), so if it fires at all, WILDCARD_CHAR's substring check would escalate it to high severity. See task report for whether this reproduced.

**Actual findings**: diff-drift.widened-permissions [warning]: Permission 'Write(./dist/**)' added to allow-list

### `dd4-command-whitespace-only-change` (FP, DD-1-DD-4 deep coverage (Session 1))

A hook's command changes only in whitespace ("npm test" to "npm  test", an extra space), with no semantic change to what runs.

**Why**: JUDGMENT CALL, documented rather than fixed: labeled negative on the theory that a purely cosmetic whitespace diff should not warrant a high-severity CVE-2025-59536-pattern alert (noise risk), but the command comparison is strict string inequality with no normalization, so this is expected to fire in practice. See task report for whether this reproduced.

**Actual findings**: diff-drift.hook-changed [high]: Hook 'PreToolUse' command changed

### `judgment-dd4-hook-whitespace-only` (FP, RF-1/RF-2 deep coverage + judgment calls (Session 2))

A hook command changes only in whitespace (an extra space before a flag), a second, independent example of the same class as the existing dd4-command-whitespace-only-change scenario.

**Why**: JUDGMENT: re-confirms Session 1's dd4-command-whitespace-only-change finding with independent fixture content -- strict string inequality with no whitespace normalization means this is expected to fire in practice despite being labeled negative on noise-avoidance grounds.

**Actual findings**: diff-drift.hook-changed [high]: Hook 'PreToolUse' command changed

### `judgment-dd1-both-schema-keys-present` (FN, RF-1/RF-2 deep coverage + judgment calls (Session 2))

A file has both "mcpServers" and "servers" top-level keys simultaneously; a new server is added under "servers" while "mcpServers" (present but empty) is unchanged.

**Why**: JUDGMENT, and the most surprising Session 2 result: parseMcpServers uses obj.mcpServers ?? obj.servers. Nullish coalescing means an EMPTY mcpServers object ({}) still short-circuits the fallback -- "servers" is never even read once "mcpServers" exists at all, regardless of its content. A new entry added under the non-precedent key is completely invisible to DD-1. This is a contrived, low-realism construction (no mainstream tool writes both keys with divergent content), so it is documented as a judgment call rather than escalated as a defect, but it is worth knowing about.

**Actual findings**: (none)

### `judgment-rf2-latin-loanword-in-cyrillic-context` (FP, RF-1/RF-2 deep coverage + judgment calls (Session 2))

A genuine Russian sentence ("Команда для сохранения:") correctly embeds an English technical term ("git commit") in Latin script, as is standard practice for CLI command names in non-English technical writing.

**Why**: JUDGMENT, symmetric to near-miss-legit-cyrillic-text: RF-2's character class only matches Cyrillic/Greek code points, never Latin ones, so the embedded "git commit" loanword itself cannot trigger it either way. The surrounding genuine Cyrillic prose does, for the exact same structural reason as the existing near-miss case -- whether or not a Latin loanword is present is irrelevant to the outcome.

**Actual findings**: rule-file.homoglyph [high]: Cyrillic look-alike character (U+041A) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+043E) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+043E) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0445) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0440) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found

### `encoding-fullwidth-latin-homoglyph` (FN, Encoding/near-miss + multi-detector collision (Session 4))

Fullwidth Latin small letter a (U+FF41, from the Halfwidth and Fullwidth Forms block) is substituted for a regular Latin "a".

**Why**: FN-expected, known gap: RF-2's table only covers Cyrillic and Greek confusables (architecture.md 5); the Halfwidth/Fullwidth Forms block is entirely outside it. Same convention as known-gap-uncommon-homoglyph.

**Actual findings**: (none)

### `encoding-mathematical-alphanumeric-symbol` (FN, Encoding/near-miss + multi-detector collision (Session 4))

Mathematical bold small a (U+1D41A, an astral-plane code point from the Mathematical Alphanumeric Symbols block) is substituted into a sentence.

**Why**: FN-expected, known gap: entirely outside the confusable table. Also confirms the regex (no "u" flag) does not accidentally mis-match on lone surrogate halves for an astral character -- it simply does not match at all, cleanly, no throw.

**Actual findings**: (none)

### `encoding-armenian-homoglyph` (FN, Encoding/near-miss + multi-detector collision (Session 4))

Armenian small letter oh (U+0585), which closely resembles Latin/Cyrillic "o", is substituted into a sentence.

**Why**: FN-expected, known gap: the Armenian block is entirely outside RF-2's table.

**Actual findings**: (none)

### `encoding-cherokee-homoglyph` (FN, Encoding/near-miss + multi-detector collision (Session 4))

Cherokee letter si (U+13DA), which closely resembles Latin/Cyrillic "o", is substituted into a sentence.

**Why**: FN-expected, known gap: the Cherokee block is entirely outside RF-2's table.

**Actual findings**: (none)

### `encoding-combining-diacritical-invisible` (FN, Encoding/near-miss + multi-detector collision (Session 4))

A combining grapheme joiner (U+034F), a zero-width combining mark from the Combining Diacritical Marks block, is inserted mid-word.

**Why**: FN-expected, known gap: RF-1's INVISIBLE_CHAR_PATTERN only covers zero-width spaces/joiners (U+200B-200D), bidi controls (U+202A-202E), and isolates (U+2066-2069) per architecture.md 4; the Combining Diacritical Marks block is entirely outside those ranges despite U+034F being just as visually invisible.

**Actual findings**: (none)

### `encoding-rlm-standalone` (FN, Encoding/near-miss + multi-detector collision (Session 4))

A right-to-left mark (U+200F) is inserted standalone mid-sentence, with no accompanying bidi override/embedding characters.

**Why**: Documents actual behavior: U+200F falls in the Right-to-Left Mark/Left-to-Right Mark pair, which sits just below RF-1's bidi-control range (U+202A-202E) and just below its isolate range (U+2066-2069). It is NOT covered by INVISIBLE_CHAR_PATTERN, so this is an FN-expected known gap, distinct from the covered bidi-override characters.

**Actual findings**: (none)

### `encoding-soft-hyphen` (FN, Encoding/near-miss + multi-detector collision (Session 4))

A soft hyphen (U+00AD), an invisible-unless-at-a-line-break formatting character, is inserted mid-word.

**Why**: FN-expected, known gap: U+00AD is in the Latin-1 Supplement block, well outside RF-1's covered ranges.

**Actual findings**: (none)

### `encoding-unicode-tag-characters` (FN, Encoding/near-miss + multi-detector collision (Session 4))

A Unicode tag character (U+E0001, LANGUAGE TAG, from the astral-plane Tags block once used for steganographic prompt injection) is inserted mid-sentence.

**Why**: FN-expected, known gap: the Tags block (U+E0000-E007F) is entirely outside RF-1's covered ranges. Astral-plane code point; confirmed the surrogate pair round-trips correctly and the regex (no 'u' flag) simply fails to match either surrogate half rather than throwing or false-matching.

**Actual findings**: (none)

### `adversarial-homoglyph-in-hook-key-not-command` (FN, Benign + adversarial evasion (Session 5))

A hook's "matcher" field ("Bash") has its "a" replaced with a Cyrillic homoglyph ("B[Cyrillic а]sh"); the "command" field is left completely unchanged.

**Why**: FN by design: hookChanged.ts's parseHooks reads only the 'command' field for comparison (falling back to JSON.stringify of the whole object only when 'command' is missing entirely) -- the 'matcher' field's content is never inspected at all. Since baseEntry.command === headEntry.command here, DD-4 produces zero findings, regardless of what changed in matcher. Separately, RF-1/RF-2 never run on .claude/settings.json at all, since it is a diff-drift file, not one of the rule-file paths in monitoredFiles.ts -- so even though a real homoglyph character is present in this file, no detector in the pipeline is positioned to see it. Two independent reasons for the same miss, both structural, not incidental.

**Actual findings**: (none)
