# RedFlag CI v1 Benchmark Results

Generated: 2026-08-06T08:54:23.207Z

## Methodology

18 synthetic PR scenarios, each a before/after file pair for one monitored file, stored under `benchmark/corpus/<scenario-id>/`. `benchmark/run.ts` runs the actual production detector functions and `aggregateFindings` against each pair -- the same dispatch logic `processPullRequestEvent.ts` uses (diff-drift files get DD-1 through DD-4; rule-file files get RF-1/RF-2 against head content only) -- with no GitHub API, webhook, or posting involved. Each scenario carries a ground-truth label (`positive` = should produce at least one finding, `negative` = should produce none). A scenario "fires" if the aggregated findings array is non-empty. No detector logic was modified to produce these numbers.

Classification:
- **TP**: positive label, fired
- **FN**: positive label, did not fire
- **FP**: negative label, fired
- **TN**: negative label, did not fire

## Headline numbers

- True positives: 8
- False positives: 3
- True negatives: 6
- False negatives: 1
- **Precision** = TP / (TP + FP) = 8 / 11 = 0.727
- **Recall** = TP / (TP + FN) = 8 / 9 = 0.889

These numbers describe this 18-scenario corpus, not a statistically representative sample of real-world PRs. The corpus intentionally includes near-miss and known-gap cases designed to surface the detectors' actual limits (see below) rather than a set chosen to look clean.

## Breakdown by detector

| Detector | Positive scenarios | Caught (TP) | Negative scenarios | Misfired (FP) |
|---|---|---|---|---|
| `diff-drift.hook-changed` | 2 | 2 | 1 | 0 |
| `diff-drift.new-mcp-server` | 1 | 1 | 2 | 1 |
| `diff-drift.swapped-mcp-server` | 1 | 1 | 1 | 1 |
| `diff-drift.widened-permissions` | 2 | 2 | 1 | 0 |
| `rule-file.homoglyph` | 2 | 1 | 1 | 1 |
| `rule-file.invisible-unicode` | 1 | 1 | 3 | 0 |

## Full scenario results

| ID | File | Ground truth | Fired? | Result | Findings |
|---|---|---|---|---|---|
| `dd1-new-server` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'browser-automation' added |
| `dd2-command-swap` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args) |
| `dd3-wildcard-added` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Bash(*)' added to allow-list |
| `dd3-plain-allow-added` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Write(.env)' added to allow-list |
| `dd4-hook-added` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: New hook 'PostToolUse' added |
| `dd4-hook-command-changed` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PreToolUse' command changed |
| `rf1-zero-width-space` | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200B) found |
| `rf2-cyrillic-homoglyph` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found |
| `benign-mcp-reorder` | `.mcp.json` | negative | false | **TN** | (none) |
| `benign-claude-md-doc-addition` | `CLAUDE.md` | negative | false | **TN** | (none) |
| `benign-permissions-narrowing` | `.claude/settings.json` | negative | false | **TN** | (none) |
| `benign-copilot-instructions-edit` | `.github/copilot-instructions.md` | negative | false | **TN** | (none) |
| `near-miss-args-reorder` | `.mcp.json` | negative | true | **FP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args) |
| `near-miss-hook-removed` | `.claude/settings.json` | negative | false | **TN** | (none) |
| `near-miss-bom` | `CLAUDE.md` | negative | false | **TN** | (none) |
| `near-miss-legit-cyrillic-text` | `CLAUDE.md` | negative | true | **FP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0440) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0420) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found |
| `near-miss-mcp-server-rename` | `.mcp.json` | negative | true | **FP** | diff-drift.new-mcp-server [warning]: New MCP server 'filesystem-server' added |
| `known-gap-uncommon-homoglyph` | `.cursor/rules/deploy.md` | positive | false | **FN** | (none) |

## False positives and false negatives, explained honestly

4 of 18 scenarios were misclassified by the tool relative to this corpus's ground truth. None of these are implementation bugs in the sense of "the code does not match its own spec" -- each is the detector behaving exactly as designed, on a case where that design has a real, documented limit. They are recorded here, not fixed, per this task's scope.

### `near-miss-args-reorder` (FP)

An MCP server's two independent CLI flags are reordered; the positional package argument stays last and behavior is unchanged.

**Why**: DD-2 compares args via JSON.stringify, which is order-sensitive by design (see the code comment: reordering CAN change execution semantics for positional CLI args, so it is deliberately treated as drift). Included to test that documented tradeoff honestly rather than assume it away.

**Actual findings**: diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args)

### `near-miss-legit-cyrillic-text` (FP)

A genuine Russian-language example sentence is added to CLAUDE.md as localization documentation -- not an attack.

**Why**: RF-2 is a pure character-class check with no natural-language awareness (architecture.md 5), so it cannot distinguish a homoglyph substituted into Latin text from a legitimate sentence written entirely in Cyrillic.

**Actual findings**: rule-file.homoglyph [high]: Cyrillic look-alike character (U+0440) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0420) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found

### `near-miss-mcp-server-rename` (FP)

An existing MCP server is renamed to a clearer key; command and args are byte-for-byte identical.

**Why**: DD-1 diffs by key name only, so it cannot tell a rename of a trusted entry apart from a genuinely new, unreviewed one.

**Actual findings**: diff-drift.new-mcp-server [warning]: New MCP server 'filesystem-server' added

### `known-gap-uncommon-homoglyph` (FN)

A homoglyph attack using Cyrillic U+0501 ('d' look-alike), a code point not in RF-2's confusable table.

**Why**: This is a real attack pattern. RF-2's table covers well-documented confusables, not the full Unicode confusables database, per architecture.md 2's accepted precision-over-recall tradeoff: RedFlag CI will miss cleverly obfuscated attacks outside its deterministic checks.

**Actual findings**: (none)
