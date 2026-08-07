# RedFlag CI v1 Benchmark Results

Generated: 2026-08-07T07:40:55.368Z

## Methodology

18 synthetic PR scenarios, each a before/after file pair for one monitored file, stored under `benchmark/corpus/<scenario-id>/`. `benchmark/run.ts` runs the actual production detector functions and `aggregateFindings` against each pair -- the same dispatch logic `processPullRequestEvent.ts` uses (diff-drift files get DD-1 through DD-4; rule-file files get RF-1/RF-2 against head content only) -- with no GitHub API, webhook, or posting involved. Each scenario carries a ground-truth label (`positive` = should produce at least one finding, `negative` = should produce none). A scenario "fires" if the aggregated findings array is non-empty. No detector logic was modified to produce these numbers.

Classification:
- **TP**: positive label, fired
- **FN**: positive label, did not fire
- **FP**: negative label, fired
- **TN**: negative label, did not fire

## Headline numbers

- True positives: 79
- False positives: 5
- True negatives: 36
- False negatives: 0
- **Precision** = TP / (TP + FP) = 79 / 84 = 0.940
- **Recall** = TP / (TP + FN) = 79 / 79 = 1.000

These numbers describe this 18-scenario corpus, not a statistically representative sample of real-world PRs. The corpus intentionally includes near-miss and known-gap cases designed to surface the detectors' actual limits (see below) rather than a set chosen to look clean.

## Breakdown by detector

| Detector | Positive scenarios | Caught (TP) | Negative scenarios | Misfired (FP) |
|---|---|---|---|---|
| `diff-drift.hook-changed` | 12 | 12 | 5 | 0 |
| `diff-drift.new-mcp-server` | 13 | 13 | 17 | 0 |
| `diff-drift.new-mcp-server + diff-drift.swapped-mcp-server` | 3 | 3 | 0 | 0 |
| `diff-drift.swapped-mcp-server` | 10 | 10 | 2 | 1 |
| `diff-drift.widened-permissions` | 14 | 14 | 4 | 2 |
| `diff-drift.widened-permissions + diff-drift.hook-changed` | 2 | 2 | 1 | 0 |
| `rule-file.homoglyph` | 12 | 12 | 2 | 2 |
| `rule-file.invisible-unicode` | 11 | 11 | 7 | 0 |
| `rule-file.invisible-unicode + rule-file.homoglyph` | 2 | 2 | 3 | 0 |

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
| `near-miss-mcp-server-rename` | `.mcp.json` | negative | false | **TN** | (none) |
| `known-gap-uncommon-homoglyph` | `.cursor/rules/deploy.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0501) found |
| `dd1-servers-key-variant` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'docs' added |
| `dd1-minimal-config` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'notify' added |
| `dd1-multiple-servers-added` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'browser' added; diff-drift.new-mcp-server [warning]: New MCP server 'database' added |
| `dd1-unicode-server-name` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'café tools' added |
| `dd1-server-added-trailing-whitespace-key` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'filesystem ' added |
| `dd2-args-only-change` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args) |
| `dd2-both-changed` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (command, args) |
| `dd2-env-var-change` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (env) |
| `dd2-version-hash-change` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (version) |
| `dd3-deny-removed-plain` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Deny rule 'Bash(curl)' removed |
| `dd3-multiple-allow-added` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Write(/tmp)' added to allow-list; diff-drift.widened-permissions [warning]: Permission 'Bash(git status)' added to allow-list |
| `dd3-permissions-block-newly-created` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Bash(npm test)' added to allow-list |
| `dd3-allow-and-deny-both-changed` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Write(/tmp)' added to allow-list; diff-drift.widened-permissions [warning]: Deny rule 'Bash(rm)' removed |
| `dd3-wildcard-narrowed-to-specific` | `.claude/settings.json` | negative | true | **FP** | diff-drift.widened-permissions [warning]: Permission 'Bash(npm test)' added to allow-list |
| `dd3-narrowing-syntax-rewrite` | `.claude/settings.json` | negative | true | **FP** | diff-drift.widened-permissions [warning]: Permission 'Write(./dist/**)' added to allow-list |
| `dd4-multiple-hooks-changed` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PreToolUse[0]' command changed; diff-drift.hook-changed [high]: Hook 'PreToolUse[1]' command changed |
| `dd4-hook-removed-single` | `.claude/settings.json` | negative | false | **TN** | (none) |
| `dd4-matcher-changed-command-same` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PreToolUse' matcher changed |
| `dd4-command-whitespace-only-change` | `.claude/settings.json` | negative | false | **TN** | (none) |
| `dd4-array-vs-object-shape` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: New hook 'PreToolUse' added |
| `dd4-new-hook-event-type` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: New hook 'SessionStart' added |
| `rf1-zero-width-joiner` | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200D) found |
| `rf1-zero-width-non-joiner` | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200C) found |
| `rf1-bidi-rlo-specific` | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+202E) found |
| `rf1-multiple-bidi-variants-one-file` | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+202A) found; rule-file.invisible-unicode [high]: Invisible Unicode character (U+202D) found; rule-file.invisible-unicode [high]: Invisible Unicode character (U+2066) found |
| `rf2-greek-homoglyph` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Greek look-alike character (U+03BF) found |
| `rf2-multiple-scripts-mixed` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Greek look-alike character (U+03BF) found |
| `rf2-homoglyph-in-code-fence` | `CLAUDE.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found |
| `rf2-homoglyph-adjacent-attack-text` | `CLAUDE.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+043E) found |
| `rf2-homoglyph-in-url` | `CLAUDE.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+0456) found |
| `judgment-dd3-deny-removed-had-wildcard` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Deny rule 'Bash(*)' removed |
| `judgment-dd1-server-re-added-identically` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'cache' added |
| `judgment-dd2-args-reorder-with-real-semantics` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'deploy' definition changed (args) |
| `judgment-dd4-hook-whitespace-only` | `.claude/settings.json` | negative | false | **TN** | (none) |
| `judgment-dd1-both-schema-keys-present` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'browser' added |
| `judgment-rf1-invisible-char-in-security-docs` | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200B) found |
| `judgment-dd3-wildcard-added-then-narrowed-same-pr` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Write(*)' added to allow-list; diff-drift.widened-permissions [warning]: Permission 'Bash(npm test)' added to allow-list |
| `judgment-rf2-latin-loanword-in-cyrillic-context` | `CLAUDE.md` | negative | true | **FP** | rule-file.homoglyph [high]: Cyrillic look-alike character (U+041A) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+043E) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+043E) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0445) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0440) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found |
| `judgment-dd4-hook-command-becomes-empty-string` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PreToolUse' command changed |
| `judgment-dd3-permission-entry-case-difference` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Bash(NPM TEST)' added to allow-list |
| `failopen-truncated-json-head` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-truncated-json-base` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-wrong-type-array-head` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-wrong-type-string-head` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-wrong-type-number-head` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-wrong-type-null-head` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-empty-file-head` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-empty-file-base` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-trailing-comma-json` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-deeply-nested-unexpected-structure` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-null-byte-embedded` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-non-utf8-bytes` | `.mcp.json` | negative | false | **TN** | (none) |
| `failopen-large-file-500kb` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'monitoring-agent' added |
| `failopen-both-sides-malformed` | `.mcp.json` | negative | false | **TN** | (none) |
| `scale-large-allow-list-20-entries` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Bash(*)' added to allow-list |
| `scale-deeply-nested-hook-config` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PostToolUse' command changed |
| `scale-long-file-buried-invisible-char` | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200B) found |
| `scale-many-mcp-servers` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'monitoring-agent' added |
| `scale-repeated-identical-hooks` | `.claude/settings.json` | negative | false | **TN** | (none) |
| `scale-minified-single-line-json` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'monitoring' added |
| `encoding-utf16-bom-le` | `CLAUDE.md` | negative | false | **TN** | (none) |
| `encoding-utf16-bom-be` | `CLAUDE.md` | negative | false | **TN** | (none) |
| `encoding-bom-not-at-start` | `CLAUDE.md` | negative | false | **TN** | (none) |
| `encoding-mixed-crlf-lf` | `CLAUDE.md` | negative | false | **TN** | (none) |
| `encoding-nfc-vs-nfd-homoglyph` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+0301) found; rule-file.homoglyph [high]: Greek look-alike character (U+03BF) found |
| `encoding-fullwidth-latin-homoglyph` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Fullwidth Latin look-alike character (U+FF41) found |
| `encoding-mathematical-alphanumeric-symbol` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Mathematical Bold look-alike character (U+1D41A) found |
| `encoding-zwsp-in-diffdrift-file` | `.mcp.json` | negative | false | **TN** | (none) |
| `encoding-armenian-homoglyph` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Armenian look-alike character (U+0585) found |
| `encoding-cherokee-homoglyph` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.homoglyph [high]: Cherokee look-alike character (U+13DA) found |
| `encoding-combining-diacritical-invisible` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+034F) found |
| `encoding-rlm-standalone` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200F) found |
| `encoding-soft-hyphen` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+00AD) found |
| `encoding-unicode-tag-characters` | `.cursor/rules/security.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+E0001) found |
| `multi-new-and-modified-server` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (command, args); diff-drift.new-mcp-server [warning]: New MCP server 'browser' added |
| `multi-wildcard-and-hook` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Bash(*)' added to allow-list; diff-drift.hook-changed [high]: New hook 'PostToolUse' added |
| `multi-deny-removed-and-allow-added` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Write(/tmp)' added to allow-list; diff-drift.widened-permissions [warning]: Deny rule 'Bash(rm)' removed |
| `multi-rf1-and-rf2-same-file` | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200B) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found |
| `multi-three-servers-mixed-changes` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'git' definition changed (command, args); diff-drift.new-mcp-server [warning]: New MCP server 'browser' added |
| `multi-all-four-diffdrift-one-pr-mcp` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (command, args); diff-drift.new-mcp-server [warning]: New MCP server 'browser' added |
| `multi-all-four-diffdrift-one-pr-settings` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Bash(*)' added to allow-list; diff-drift.hook-changed [high]: New hook 'SessionStart' added |
| `benign-version-bump-in-args` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'git' definition changed (args) |
| `benign-new-unrelated-toplevel-key` | `.mcp.json` | negative | false | **TN** | (none) |
| `benign-hook-added-for-linting` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: New hook 'PostToolUse' added |
| `benign-multiple-permissions-narrowed` | `.claude/settings.json` | negative | false | **TN** | (none) |
| `benign-claude-md-typo-fix` | `CLAUDE.md` | negative | false | **TN** | (none) |
| `benign-cursor-rules-new-clean-file` | `.cursor/rules/style.md` | negative | false | **TN** | (none) |
| `benign-copilot-instructions-formatting-only` | `.github/copilot-instructions.md` | negative | false | **TN** | (none) |
| `benign-comment-like-key-added` | `.mcp.json` | negative | false | **TN** | (none) |
| `benign-settings-unrelated-section-added` | `.claude/settings.json` | negative | false | **TN** | (none) |
| `benign-hooks-reorganized-same-behavior` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PreToolUse' command changed |
| `adversarial-cross-file-attack-split` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: New hook 'PostToolUse' added |
| `adversarial-rename-masks-swap` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'new-fs' added |
| `adversarial-broad-non-wildcard-pattern` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [high]: Wildcard permission 'Bash' added to allow-list |
| `adversarial-homoglyph-plus-invisible-combo` | `CLAUDE.md` | positive | true | **TP** | rule-file.invisible-unicode [high]: Invisible Unicode character (U+200B) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found |
| `adversarial-split-command-across-args` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'git' definition changed (args) |
| `adversarial-benign-name-malicious-command` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'linter' added |
| `adversarial-gradual-drift-two-prs-pr1` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Bash(git diff)' added to allow-list |
| `adversarial-gradual-drift-two-prs-pr2` | `.claude/settings.json` | positive | true | **TP** | diff-drift.widened-permissions [warning]: Permission 'Bash(git *)' added to allow-list |
| `adversarial-homoglyph-in-hook-key-not-command` | `.claude/settings.json` | positive | true | **TP** | diff-drift.hook-changed [high]: Hook 'PreToolUse' matcher changed |
| `adversarial-encoded-payload-in-args` | `.mcp.json` | positive | true | **TP** | diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args) |
| `adversarial-mimics-approved-pattern` | `.mcp.json` | positive | true | **TP** | diff-drift.new-mcp-server [warning]: New MCP server 'filesystem-v2' added |

## False positives and false negatives, explained honestly

5 of 18 scenarios were misclassified by the tool relative to this corpus's ground truth. None of these are implementation bugs in the sense of "the code does not match its own spec" -- each is the detector behaving exactly as designed, on a case where that design has a real, documented limit. They are recorded here, not fixed, per this task's scope.

### `near-miss-args-reorder` (FP)

An MCP server's two independent CLI flags are reordered; the positional package argument stays last and behavior is unchanged.

**Why**: DD-2 compares args via JSON.stringify, which is order-sensitive by design (see the code comment: reordering CAN change execution semantics for positional CLI args, so it is deliberately treated as drift). Included to test that documented tradeoff honestly rather than assume it away.

**Actual findings**: diff-drift.swapped-mcp-server [high]: MCP server 'filesystem' definition changed (args)

### `near-miss-legit-cyrillic-text` (FP)

A genuine Russian-language example sentence is added to CLAUDE.md as localization documentation -- not an attack.

**Why**: RF-2 is a pure character-class check with no natural-language awareness (architecture.md 5), so it cannot distinguish a homoglyph substituted into Latin text from a legitimate sentence written entirely in Cyrillic.

**Actual findings**: rule-file.homoglyph [high]: Cyrillic look-alike character (U+0440) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0420) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found

### `dd3-wildcard-narrowed-to-specific` (FP)

An existing "Bash(*)" allow entry is replaced with the narrower "Bash(npm test)".

**Why**: Intended as a narrowing (a wildcard replaced by one specific command) that should not fire. DD-3 only checks whether each head allow string is present in base's allow set -- it does not correlate a removal with an addition, so "Bash(npm test)" reads as a brand-new allow entry regardless of what it replaced. See task report for whether this reproduced.

**Actual findings**: diff-drift.widened-permissions [warning]: Permission 'Bash(npm test)' added to allow-list

### `dd3-narrowing-syntax-rewrite` (FP)

An existing "Write(*)" allow entry is reworded to "Write(./dist/**)", scoping writes to one directory.

**Why**: Intended as a narrowing. The replacement string still contains a literal "*" character (from the "**" glob), so if it fires at all, WILDCARD_CHAR's substring check would escalate it to high severity. See task report for whether this reproduced.

**Actual findings**: diff-drift.widened-permissions [warning]: Permission 'Write(./dist/**)' added to allow-list

### `judgment-rf2-latin-loanword-in-cyrillic-context` (FP)

A genuine Russian sentence ("Команда для сохранения:") correctly embeds an English technical term ("git commit") in Latin script, as is standard practice for CLI command names in non-English technical writing.

**Why**: JUDGMENT, symmetric to near-miss-legit-cyrillic-text: RF-2's character class only matches Cyrillic/Greek code points, never Latin ones, so the embedded "git commit" loanword itself cannot trigger it either way. The surrounding genuine Cyrillic prose does, for the exact same structural reason as the existing near-miss case -- whether or not a Latin loanword is present is irrelevant to the outcome.

**Actual findings**: rule-file.homoglyph [high]: Cyrillic look-alike character (U+041A) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+043E) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0441) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+043E) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0445) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0440) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0430) found; rule-file.homoglyph [high]: Cyrillic look-alike character (U+0435) found
