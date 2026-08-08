# RedFlag CI — SARIF / JSON Export and Exit-Code Threshold

Three pure utility functions ship alongside the core GitHub App:

| Function | File | Returns |
|---|---|---|
| `formatFindingsAsSarif(findings)` | `src/exportSarif.ts` | SARIF 2.1.0 JSON string |
| `formatFindingsAsJson(findings)` | `src/exportJson.ts` | Plain JSON envelope string |
| `computeExitCode(findings, threshold?)` | `src/exitCodeThreshold.ts` | `0` or `1` |

All three are **pure functions** — no I/O, no side effects, same input always produces the same output. They operate on the same `Finding[]` that the PR-comment formatter already receives and are tested independently of the webhook pipeline.

> **Not yet wired into the webhook.** These functions exist as tested, exported utilities. Calling them from `processPullRequestEvent.ts` and writing the output somewhere (a GitHub Actions artifact, a Gist, a commit status) is a separate wiring task. The worked example below shows how a consumer can use them today via a script step.

---

## What each function is for

### `formatFindingsAsSarif`

Produces a [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html)-compliant JSON string. SARIF is the format GitHub Code Scanning uses natively: upload a SARIF file and findings appear in the repository's **Security → Code scanning** tab, with inline annotations on the diff and a queryable findings history — without RedFlag CI needing to build or host any dashboard.

Schema mapping:
- `tool.driver.name` = `"RedFlag CI"`
- `tool.driver.rules` — one entry per unique `detectorId`, not per finding
- Each finding → one `results[]` entry: `ruleId` = `detectorId`, `level` = severity mapped (`high` → `"error"`, `warning` → `"warning"`, `info` → `"note"`), `message.text` = `detail`
- `locations[0].physicalLocation.artifactLocation.uri` = `file`
- `region` is **omitted** — the `Finding` interface carries no structured line/column fields today; detectors that locate a character embed position text in `detail` as prose rather than typed fields. No fabricated `1,1`.

### `formatFindingsAsJson`

Produces a minimal JSON envelope for consumers that don't want SARIF's verbosity. No field renaming, no schema mapping — all `Finding` fields pass through exactly as-is.

```json
{
  "tool": "RedFlag CI",
  "findingCount": 2,
  "findings": [
    {
      "detectorId": "diff-drift.new-mcp-server",
      "severity": "warning",
      "file": ".mcp.json",
      "summary": "New MCP server 'example' added",
      "detail": "The head branch adds a new MCP server entry 'example' to .mcp.json..."
    }
  ]
}
```

### `computeExitCode`

Returns `1` if any finding meets or exceeds the given severity threshold, `0` otherwise. Severity ordering: `high > warning > info`.

**This function is advisory and consumer-side only.** It does not change RedFlag CI's own check-run behavior, which always reports `success` or `neutral`, never `failure` (architecture.md §6: "RedFlag CI reports, it never fails the build"). Whether a finding should block a PR is a decision for your repo's own branch protection rules. `computeExitCode` is the mechanism for a team to enforce that in their own CI step, independently of this tool's GitHub App.

**Opt-in by construction:** if `threshold` is `undefined` (not passed), the function always returns `0`. There is no code path that produces a `1` without an explicit threshold.

```typescript
computeExitCode(findings);             // always 0 — no threshold configured
computeExitCode(findings, 'high');     // 1 only if at least one high finding
computeExitCode(findings, 'warning'); // 1 if any high or warning finding
computeExitCode(findings, 'info');    // 1 if any finding at all
```

---

## Worked example — GitHub Actions

This snippet shows how a team would call RedFlag CI's exports from a separate job in their own workflow, upload the SARIF output to GitHub's Security tab, and optionally fail the job if any high-severity finding is present.

> **Prerequisite:** The functions aren't yet called from the webhook pipeline, so this example invokes them via a small inline script step. Once the wiring task ships, the export files will be written by the webhook itself and this script step becomes optional.

```yaml
name: RedFlag CI export

on:
  pull_request:
    paths:
      - '.mcp.json'
      - '.claude/**'
      - 'CLAUDE.md'
      - '.cursor/rules/**'
      - '.github/copilot-instructions.md'

permissions:
  contents: read
  security-events: write   # required for upload-sarif

jobs:
  redflag-export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci
        working-directory: backend

      - name: Run RedFlag CI and write exports
        working-directory: backend
        env:
          GITHUB_APP_ID: ${{ secrets.REDFLAG_APP_ID }}
          GITHUB_APP_PRIVATE_KEY: ${{ secrets.REDFLAG_PRIVATE_KEY }}
          GITHUB_WEBHOOK_SECRET: ${{ secrets.REDFLAG_WEBHOOK_SECRET }}
        run: |
          node -e "
          const { formatFindingsAsSarif } = require('./dist/exportSarif');
          const { formatFindingsAsJson } = require('./dist/exportJson');
          const { computeExitCode } = require('./dist/exitCodeThreshold');
          const fs = require('fs');

          // Replace this with however your pipeline collects findings.
          // Once the wiring task ships, the webhook will write findings
          // to a file and this script reads them from there instead.
          const findings = JSON.parse(fs.readFileSync('redflag-findings.json', 'utf8'));

          fs.writeFileSync('redflag-results.sarif', formatFindingsAsSarif(findings));
          fs.writeFileSync('redflag-results.json', formatFindingsAsJson(findings));

          // Optional: exit 1 if any high-severity finding is present.
          // Remove or change the threshold to 'warning'/'info' as needed.
          // This does NOT affect RedFlag CI's own check run (always success/neutral).
          process.exit(computeExitCode(findings, 'high'));
          "

      - name: Upload SARIF to GitHub Security tab
        # Runs even if the previous step exits 1 (continue-on-error keeps
        # the upload happening regardless of the threshold decision above).
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: backend/redflag-results.sarif
          category: redflag-ci

      - name: Upload plain JSON as workflow artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: redflag-findings
          path: backend/redflag-results.json
```

### What this does

1. **Builds and runs** RedFlag CI in the workflow context.
2. **Writes two export files** — a SARIF file for GitHub Code Scanning and a plain JSON file for any other consumer (Slack bot, badge, custom dashboard).
3. **Uploads the SARIF** to GitHub's Security tab via `github/codeql-action/upload-sarif@v3`. Findings appear as inline annotations on the diff and persist in **Security → Code scanning**.
4. **Optionally exits with code 1** if the threshold is met, which marks the workflow job as failed. This is separate from RedFlag CI's own check run — that check run stays `success`/`neutral` regardless.

### `category: redflag-ci`

The `category` input distinguishes this SARIF upload from any other Code Scanning tool (CodeQL, Semgrep, etc.) running on the same repo. Keep it stable across runs so GitHub accumulates a history under this category rather than creating a new series each time.

---

## Severity threshold reference

| Threshold | Exits 1 when... |
|---|---|
| `'high'` | At least one `high` finding |
| `'warning'` | At least one `high` or `warning` finding |
| `'info'` | Any finding at all |
| `undefined` (default) | Never — always exits 0 |
