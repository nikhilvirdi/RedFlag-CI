# RedFlag CI: Architecture

This is the complete reference for RedFlag CI: what it is, why it exists, what else is out there, how it's built, why every major decision was made, and what each planned version through v2.0.0 (the project's final version) actually contains. If something in `workplan.md` seems to contradict this file, this file wins; `workplan.md` should be updated to match.

## 1. What RedFlag CI is

A GitHub App that scans pull requests for risky changes to AI agent configuration, specifically the files that control what an AI coding agent is allowed to do and what instructions it follows. It comments on a PR only when it finds something worth flagging. Sections 2 and 3 cover the research and competitive landscape behind this scope; the rest of this document covers the system itself.

## 2. Background and problem space

### AI-generated code ships with more security flaws, at higher volume

Veracode's 2025 GenAI Code Security Report found that a large share of AI-generated code, on the order of 41 to 62% depending on methodology, introduces at least one security vulnerability. Separately, CodeRabbit's analysis of AI-coauthored pull requests found close to double the issue rate of human-written PRs overall, and nearly triple for certain vulnerability classes like cross-site scripting. Georgia Tech's Vibe Security Radar, which traces CVEs directly back to AI-generated code using commit metadata, recorded 6 such CVEs in January 2026, 15 in February, and 35 in March, a trend the researchers describe as a lower bound, since developers frequently strip the metadata that makes attribution possible.

### Agent configuration is a new and largely unguarded attack surface

The Model Context Protocol, which standardizes how AI agents read external tools and context, grew to tens of millions of monthly downloads and thousands of public servers within about a year of its release. Security practice didn't keep pace. Independent audits found the large majority of tested MCP servers vulnerable to path traversal, a substantial share vulnerable to command injection or server-side request forgery, and hundreds of servers exposed to the open internet with no authentication at all.

The incident record is concrete, not hypothetical:

- CVE-2026-25253, the first CVE ever assigned to an agentic AI system, was quickly followed by the ClawHavoc campaign, which planted malicious agent skills into a public marketplace and used them to distribute credential-stealing malware.
- CVE-2025-59536 exploits Claude Code's hooks by injecting a malicious hook into `.claude/settings.json`.
- CVE-2025-54136, known as MCPoison, achieves persistent remote code execution by swapping a trusted, already-approved MCP configuration for a malicious one.
- CVE-2025-6514, a critical (CVSS 9.6) command-injection bug in a widely used MCP package, was downloaded over 400,000 times before disclosure.
- Researchers have separately demonstrated invisible Unicode characters injected into rule files like `CLAUDE.md` and `.cursor/rules`, silently directing an agent to embed malicious code in everything it generates afterward, with nothing visible in a normal diff view.

### The bigger, separate problem: noise

Independent of what a tool can technically detect, the dominant complaint across every AI code-review tool on the market is the same: too many false positives. Reported rates run as high as 87% in some evaluations, and up to 40% of AI-generated review comments get ignored outright. Developer sentiment on forums like Hacker News describes these tools as producing "pure noise," to the point that some reviewers contradict their own prior suggestions when a developer implements the exact fix they recommended.

This matters more than it might first appear. A tool that finds real issues but drowns them in false ones gets muted within a week, and the security benefit disappears with it. Any credible design in this space has to treat noise as a first-class constraint, not an acceptable side effect of thoroughness.

### Why PR-diff-time analysis has a real ceiling

Vulnerability chaining, tracing a tainted input through to an exploitable sink, requires visibility into code that may live entirely outside the current diff. If the sink is in the PR but the source lives in a file nobody touched, a diff-only tool structurally cannot see the connection. This isn't a tooling gap that better engineering closes; ASPM vendors and reachability-analysis researchers are consistent on this point. It's the reason RedFlag CI doesn't attempt general vulnerability chaining, and instead scopes itself to detections that genuinely fit within a diff's boundaries: a file changed, an entry added, a character that shouldn't be there.

Static detection of prompt-injection paths runs into the same ceiling. Academic work in this area, including a 2026 paper evaluating static dataflow analysis for exactly this problem, confirms it's technically real, but only when the full source-to-sink path is visible to the analyzer. When prompt construction spans multiple files or services, which it usually does, a PR-diff-scoped tool can't reliably trace it. Claims that a diff-only tool can autonomously map these paths are, at this point, mostly marketing language rather than demonstrated capability.

## 3. Competitive landscape

This section records what already exists in the AI-code-security space, and exactly where RedFlag CI's scope does and doesn't overlap with it. The goal is to be honest about what's already solved rather than assume a gap exists just because it wasn't found on the first pass.

### What's already commoditized (and deliberately out of scope here)

**Hallucinated packages and slopsquatting.** Socket.dev ships a free GitHub App that flags suspicious new dependencies directly on a pull request. Aikido's SafeChain wraps npm, yarn, and pnpm to block known-bad installs before they happen. Between the two, this problem already has solid, freely available coverage. RedFlag CI doesn't attempt it.

**Auto-fix and general AI-generated application code review.** This category is both crowded and well funded: CodeRabbit raised a $60M Series B, Greptile reached a $180M valuation, and dedicated AI-native security platforms like OX Security's VibeSec and Backslash Security (a $19M Series A) are already targeting this exact problem, in some cases pushing detection earlier than PR time, into the code-generation step itself. RedFlag CI isn't trying to out-build funded competitors on their own turf.

### What's closer to RedFlag CI's actual territory

Direct-source review turned up several tools already working on agent-config and MCP security specifically, which is worth stating plainly rather than glossing over:

- **AgentShield**, built during a February 2026 Anthropic hackathon, ships as a CLI, a GitHub Action, and a GitHub App, and already scans `.claude/` configuration, MCP servers, and hooks, with baseline and drift-gating features.
- **mcp-scan** (Invariant Labs) is close to a category standard for detecting tool poisoning and rug-pull attacks against MCP servers, with both static and proxy modes.
- **Snyk** ships its own open-source agent/skill scanner, and **MCPShield** and **eSentire's MCP-Scanner** cover overlapping ground.

So the honest framing is: PR-time scanning of agent configuration is not virgin territory. What's left is narrower, but still real.

### The gap that's actually still open

Two structural problems show up across nearly every existing tool in this space, regardless of which company built it:

**Pattern-based scanners are fast and local, but noisy.** Static, rule-based detection, the approach behind tools like Cisco's mcp-scanner, produces false-positive rates as high as 78% in practice, largely because MCP tool descriptions are full of ordinary imperative language ("call this tool," "run this query") that a blunt pattern match can't distinguish from an actual attack.

**LLM-based scanners are more accurate, but leave the local machine.** Tools like Invariant Guardrails and academic systems like MCP-Guard get meaningfully better accuracy by reasoning semantically, at the cost of sending configuration data to a cloud service, adding latency, and adding a per-scan token cost.

Nobody has combined low-noise, fully local, and PR-native in one tool. That combination is RedFlag CI's actual target, and it shapes four concrete decisions:

1. **Diff-aware, not single-shot.** Every existing tool checked here evaluates a config file's current state. None of them treat "what changed since the base branch" as the primary signal. RedFlag CI's diff-drift engine (section 7) is built around exactly that: a new MCP server, a swapped tool, a widened permission, a new hook, are all diff facts, not judgment calls.
2. **A separate, distinct detection problem: rule-file injection.** Existing tools concentrate on MCP server behavior and tool descriptions. Hidden-character injection in `CLAUDE.md`, `.cursor/rules`, and Copilot instruction files is a different attack surface, and it's covered here as its own detector pair rather than an afterthought.
3. **Deterministic by construction, not by tuning.** Instead of trying to tune a pattern-matcher down to an acceptable false-positive rate, RedFlag CI's v1 detectors are restricted to checks that are true-or-false by definition: a character is present or it isn't, an entry was added or it wasn't. This sidesteps the precision problem instead of chasing it.
4. **Built for the developer opening the PR, not the security team opening a dashboard.** No SARIF, no posture score, no separate UI in v1. One comment, when there's something worth saying.

### What this doesn't guarantee

None of the above is a permanent moat on its own. AgentShield in particular could plausibly add diff-awareness without much difficulty. The more durable advantage is the combination and the restraint behind it: staying quiet on unaffected PRs, refusing to chase recall at the cost of trust, and building the drift engine as the actual technical center of the project rather than a checkbox feature. That's a product-design choice as much as a technical one, and it's the thing worth defending as the project grows.

## 4. Design principles

These aren't just preferences. Each one is a direct response to a specific failure mode found during research, and each is a constraint later phases have to respect.

**Deterministic-only in v1.** No LLM calls, no ML models, no semantic reasoning. Every detector is a plain function operating on file contents and diffs. This is what makes the tool's output predictable and its false-positive rate close to zero, which matters more than catching everything, given that the single biggest complaint about every competing tool is noise.

**Precision over recall.** RedFlag CI will miss cleverly obfuscated attacks that don't rely on invisible characters or an obvious permission change. That's an accepted tradeoff, not an oversight. A tool developers trust because it's quiet is more valuable than one that's thorough but gets muted after a week.

**Fail-open.** A malformed or unparseable config file never blocks a PR. The affected check reports neutral, and RedFlag CI moves on. Security tools that break builds on files they can't parse train people to disable them.

**Least privilege.** The GitHub App requests only the permissions it needs: `contents:read`, `pull_requests:write`, `checks:write`. Nothing broader, regardless of what a future version might eventually want.

**Zero-config, quiet by default.** Install it, and it works. No dashboard, no settings screen, no required setup. Silence on an unaffected PR is itself part of the product.

**Stateless in v1 and v1.2.0.** No database. The "baseline" for drift detection is just the PR's base branch, fetched fresh through GitHub's API on every run. v2 adds the one piece of cross-PR memory this design needs, but does it with a git-native snapshot rather than a database -- see section 10.

**Additive versions, no breaking changes.** Every version from v1.2.0 onward adds a capability without altering v1's default behavior. Nothing is ever forced on by an upgrade. See section 10 for the full versioning strategy.

## 5. System architecture (v1)

```
Pull request opened or updated
        |
        v
GitHub webhook -> RedFlag CI service
        |
        v
Verify webhook signature
        |
        v
Does the diff touch a monitored file? --- no --> stop, no comment, check passes
        |
       yes
        v
Fetch base-branch and head-branch versions of each touched monitored file
        |
        v
Run the relevant detector(s) against the before/after pair
        |
        v
Aggregate findings
        |
        v
Any findings? --- no --> post a passing check, no comment
        |
       yes
        v
Post one PR comment describing each finding
Post a neutral check run (informational, never blocking)
```

The whole thing is one Express service. No queue, no worker process, no scheduled jobs. A webhook triggers a synchronous handler that finishes in well under a second, since the entire operation is a handful of small file fetches and pure-function checks.

## 6. Monitored files

**Diff-drift engine watches:**
- `.mcp.json`
- `.cursor/mcp.json`
- `claude_desktop_config.json`
- `.claude/settings.json` (permissions and hooks)

**Rule-file engine watches:**
- `CLAUDE.md`
- `.cursor/rules/*` (any file under this directory)
- `.github/copilot-instructions.md`

A PR that doesn't touch any file in either list produces no output at all.

## 7. Detector specifications (v1)

Every detector has the same shape: it receives a before-state and an after-state of a file (the after-state is absent for the rule-file engine, since those checks don't need a diff) and returns zero or more findings.

```typescript
interface Finding {
  detectorId: string;       // e.g. "diff-drift.new-mcp-server"
  severity: "info" | "warning" | "high";
  file: string;             // repo-relative path
  summary: string;          // one-line description for the PR comment
  detail: string;           // longer explanation, includes a CVE reference where one applies
}
```

### Diff-drift engine

**DD-1: New MCP server added.** Compares the set of server entries between base and head. Any entry present in head but absent from base is a finding. Severity: `warning`.

**DD-2: Pinned tool or version swapped.** For a server entry present in both base and head, compares the command, arguments, any pinned version or hash, and any environment variables. A change to any of these on an existing entry is a finding, since an env-var swap (for example, redirecting a server to a different endpoint) is functionally the same MCPoison-shaped risk as a command or argument swap. This is the MCPoison pattern: a trusted, already-approved tool silently repointed to something else. Severity: `high`.

**DD-3: Permission or allow-list widened.** Compares the permissions and allow-list arrays in `.claude/settings.json`. A finding fires when the head version adds entries not present in base, removes a deny rule present in base, or introduces a wildcard where none existed. Severity: `warning`, escalated to `high` if a wildcard is introduced.

**DD-4: Hook added or changed.** Compares the hooks section of `.claude/settings.json`. A new hook, a change to an existing hook's command, or a change to its matcher/trigger scope, is a finding, since broadening what a hook applies to (for example, from "Bash" to "*") is a real widening of the hook's effective reach independent of whether the command itself changed. This is the vector behind CVE-2025-59536. Severity: `high`.

### Rule-file engine

**RF-1: Invisible Unicode.** Scans file contents for zero-width spaces, zero-width joiners, and bidirectional-override characters. Any match is a finding, since there's no legitimate reason for these characters to appear in a markdown instruction file. Severity: `high`.

**RF-2: Homoglyph characters.** Scans for Cyrillic and Greek characters that are visually identical to Latin ones (for example, a Cyrillic "а" standing in for a Latin "a"). Severity: `high`.

Both rule-file detectors are pure character-class checks. No natural-language interpretation, no judgment calls, which is why they carry a near-zero false-positive rate.

### v1.2.0 additions (Phase 5)

Six further detectors, all dispatched alongside DD-1 through DD-4 against the same diff-drift-monitored files. Five of the six are current-state checks against head content only, not a base/head diff -- an unpinned dependency, an obfuscated command, a duplicate key, a suspicious network target, or a path-traversal sequence is a live risk on every PR it's still present in, not just the PR that introduced it. The sixth, transport-type change, is a diff check like DD-1 through DD-4, since "changed transport" is inherently a before/after comparison.

**Unpinned MCP dependency** (`diff-drift.unpinned-mcp-dependency`). For every MCP server entry whose command is `npx`, checks whether the package argument carries an explicit `@version` pin. No pin means npx always resolves to whatever release is currently published on the registry, so a compromised or malicious package update reaches every agent invocation immediately, with no PR for anyone to review. Severity: `warning`.

**Obfuscated command** (`diff-drift.obfuscated-command`). Scans MCP server commands and arguments, and hook commands, for two patterns: output piped directly into a shell (`| sh` or `| bash`), and a long base64-looking token (20 or more base64-alphabet characters, excluding tokens that are hex digits end to end, which excludes git hashes and checksums from matching on charset alone). Either pattern lets a payload pass through review as opaque or pre-execution text while a shell or interpreter still runs it. Severity: `high`.

**Duplicate top-level JSON key** (`diff-drift.duplicate-json-key`). A raw-text scan, not a `JSON.parse`-based one, since parsing silently collapses a duplicate key onto its last occurrence before any code built on the parsed object could ever see it. Flags a top-level key (for example, a second `mcpServers`) appearing more than once in the file. Some JSON parsers resolve a duplicate to its last occurrence, others to its first, so a second occurrence can smuggle a payload past a reviewer who only reads the first, legitimate-looking one. Severity: `warning`.

**Suspicious network target** (`diff-drift.suspicious-network-target`). Scans MCP server arguments and environment variable values for a non-HTTPS `http://` URL or a bare IPv4 address, excluding localhost/loopback targets and an IP already following an `https://` or `http://` prefix (already covered by the URL check). Unencrypted HTTP exposes traffic and credentials to interception; a bare IP bypasses domain validation, TLS certificate verification, and DNS governance. Severity: `warning`.

**Path traversal** (`diff-drift.path-traversal`). Scans MCP server arguments and environment variable values for a `../` or `..\` sequence. Navigating outside an expected directory boundary this way can expose sensitive system files or escape directory sandboxing. Severity: `warning`.

**Transport-type change** (`diff-drift.transport-type-change`). For a server entry present in both base and head, flags a flip between a "local" shape (a `command`, no `url` or `transport`) and a "remote" shape (`url` and/or `transport`, no `command`), in either direction. A locally-run process executes with local privileges and is visible in the repo; a remote endpoint executes outside your control and receives whatever the agent sends it. This is a trust-boundary jump independent of any single field's value, and DD-2's own command-field comparison may already report the same entry as changed, but only generically -- this reports specifically that the server's transport changed. Severity: `high`.

**RF-1/RF-2 extended to JSON keys.** RF-1 and RF-2 originally only scanned rule-file prose (`CLAUDE.md`, `.cursor/rules/*`, `.github/copilot-instructions.md`). Phase 5 extends their reach, unchanged, to MCP server names and permission allow/deny entries in diff-drift files -- identifier-like JSON strings a human reviewer tends to skim past. Not a new detector ID: findings still carry `rule-file.invisible-unicode` or `rule-file.homoglyph`, at the same severities as section 7's rule-file entries above.

**DD-8: Monitored file deleted** (`diff-drift.monitored-file-deleted`). DD-1 through DD-7 all correctly return no findings when a file's head content is absent -- there's nothing left to compare. But a monitored file's outright deletion is itself the most severe possible change: every permission, hook, and server definition it held disappears in one PR, with every per-detector null-head check independently and correctly staying silent about it. DD-8 closes that gap at the dispatch level, not inside any individual detector: for a diff-drift file present in base and absent in head, it fires once, in place of DD-1 through DD-7 (which have nothing to scan anyway). Severity: `high`.

**Cross-cutting: Unicode normalization.** Not a numbered detector, but a change that applies to every one of them. All string comparisons and set-membership checks -- server keys, permission entries, hook fields -- normalize to NFC (`String.prototype.normalize('NFC')`) before comparing, everywhere in the codebase. Without this, two byte-different but visually identical representations of the same string (for example, an accented character as one precomposed code point versus a base letter plus a combining mark) could either dodge a "same entry" match and read as a spurious add/remove pair, or let a duplicate-key/duplicate-server-name attack slip past a check that only compares raw, un-normalized strings.

## 8. Output

**PR comment**, posted only if there's at least one finding, one comment per PR run (not one per finding), formatted as a short list: what changed, in which file, and why it matters, with a CVE reference where one applies.

**Check run status**: `success` (no findings, or the diff didn't touch a monitored file) or `neutral` (findings present). RedFlag CI never fails a check. Blocking a merge is a decision for the repository's own branch protection rules, not something this tool imposes by default.

## 9. Tech stack

Fixed to the maintainer's existing stack, since v1's scope needs nothing exotic:

- **Node.js + Express + TypeScript**, strict mode
- **@octokit/app** and **@octokit/rest** for GitHub App authentication and API calls
- **Zod** for validating webhook payloads
- **Jest + Supertest** for testing; every detector is a pure function, so each gets a direct unit test plus fixture files
- **Winston** for logging, **Morgan** for request logging
- **Docker** for packaging, **GitHub Actions** for CI

Deliberately not used in v1, despite being in the maintainer's broader toolkit: PostgreSQL/Prisma, Redis, MongoDB, Socket.io, GraphQL. None of them are needed at any point in this project's roadmap (see section 10) -- v2's cross-PR memory is handled with a git-native snapshot, not a database -- so adding any of them would just be unused surface area.

## 10. Versioning roadmap

Full detail on the versioning convention, branching model, and release process lives in the project's release strategy notes. This section covers what each version actually contains.

This roadmap is closed. v2.0.0 is the final release. No version beyond it exists, and none will be added; the project is complete.

### v1.1.0 [SHIPPED]: dual deterministic engine

The complete scope of sections 5 through 8. Ships as a stateless service with no persistence layer. Hardened once already post-launch: the benchmark corpus grew from 18 to 120 scenarios across six rounds of stress-testing, surfacing one real detector defect (fixed) and five further precision/recall gaps (all fixed). See `CHANGELOG.md` and the [adversarial-tests repo's stress-testing notes](https://github.com/nikhilvirdi/redflag-ci-adversarial-tests/blob/main/STRESS_TESTING.md).

### v1.2.0 [SHIPPED]: detector hardening and pipeline correctness

A second hardening pass, still fully within v1's deterministic design, no new capability tier. Covers three kinds of work:

- **Detection fixes**, closing gaps the 120-scenario benchmark documented as known limitations rather than defects: RF-2 adopts Unicode's official confusables table in place of the hand-picked one; RF-1's character ranges expand to cover combining diacriticals and the Unicode Tags block; DD-1 and DD-3 gain shared remove/add correlation logic so a rename or a narrowing no longer reads as a brand-new, unreviewed entry; DD-2's argument comparison becomes order-insensitive for flagged (non-positional) arguments; DD-1's `mcpServers`/`servers` dual-key handling is fixed to merge rather than short-circuit.
- **New deterministic detectors**, closing gaps that were simply out of scope before: unpinned MCP dependency versions, obfuscated commands (base64 blobs, shell piping), homoglyphs and invisible-Unicode in JSON config keys as well as markdown rule files, duplicate top-level JSON keys, suspicious network targets (bare IPs, non-HTTPS URLs), path traversal in args/env, a local-to-remote MCP transport-type change, and project-wide Unicode normalization before any string comparison.
- **Pipeline correctness**, independent of detection logic: PR comment and check-run idempotency on `synchronize` events (edit the existing comment instead of posting a new one on every push, so the tool stays quiet the way its own design principles require), webhook delivery deduplication via the `X-GitHub-Delivery` header, and an audit confirming Octokit's rate-limit/throttling handling is actually wired in, so a rate-limit failure can't be silently absorbed by the fail-open policy and reported as "clean."

The benchmark corpus expands again in this version, incorporating real-world-sourced scenarios where they can be found, in addition to continued deliberate stress-testing. The exact final scenario count is determined during this version's development, not fixed in advance; what matters is coverage, not a target number.

### v2.0.0 [SHIPPED]: cross-PR drift memory and interoperable output

The last version this project has. No version beyond it exists, and none will be added -- with Phase A and Phase B both complete, there is nothing left on the roadmap to build.

**Phase A: cross-PR drift memory.** v1 and v1.2.0 were both fully stateless: every check compared a PR's base branch to its head branch, with no memory of anything outside that single diff. The benchmark's own stress-testing had documented the resulting blind spot directly: two small, individually unremarkable permission widenings across two separate pull requests each looked fine on their own, because nothing tracked a pattern across PRs. Phase A closes this without a database (`src/baseline.ts`): a small JSON snapshot, storing each monitored diff-drift file's raw content exactly as it stood at the last merge, is committed to a dedicated `redflag-ci/baseline` branch. Not Postgres, and this reaffirms the same reasoning that already ruled a database out for v1 -- section 4's "no dashboard" design principle means a persistence layer backing data nobody's UI displays is unused surface area, and it would break the zero-config, install-and-it-works promise the whole project is positioned on. A git branch gives durable, versioned, access-controlled storage with no hosting requirement, which is everything this feature actually needed.

The snapshot updates only when a PR actually merges (`src/baselineUpdate.ts`): the signal is the `pull_request` webhook's `closed` action with `merged: true`, not a `push` event to the base branch. A push fires for any commit landing there -- a direct push, a force-push, a merge done outside a reviewed PR -- not only a genuine merge, and carries no PR number to correlate back to one, so it can't reliably distinguish "a PR actually merged" from "something else changed this branch." An unmerged PR can never influence the stored baseline, even indirectly. Detection (`src/cumulativeDrift.ts`) then compares the current PR against this stored baseline in addition to its own base branch, by feeding the baseline's stored content into the exact same detectors that already compare base to head -- no separate comparison logic duplicated. Because the snapshot is overwritten on every merge, it always reflects the cumulative effect of every merge before it, not only the one immediately preceding the current PR, which is what actually catches two individually-unremarkable widenings landing across two separate pull requests. The baseline branch's own protection status is checked after every write, and a missing one is logged as a warning, since an unprotected branch could be pushed to directly, bypassing the merge-only update path entirely; the stored snapshot also carries a SHA-256 integrity hash, verified on every read, so tampering outside that path is caught and logged distinctly rather than silently trusted. When the cross-PR check fires, the PR comment gets its own dedicated section showing exactly what changed since the baseline, not merged invisibly into the PR's own findings list.

**Phase B: SARIF and JSON export.** Not a new detector, just two additional, machine-readable serializations of findings the tool already produces, plus an advisory exit-code helper. All three (`src/exportSarif.ts`, `src/exportJson.ts`, `src/exitCodeThreshold.ts`) are pure functions -- no I/O, tested independently, and deliberately not called from `processPullRequestEvent.ts` or `postFindings.ts`. A team wires them into a separate GitHub Actions workflow of their own; the full function reference and a worked example follow directly below. SARIF output uploads to GitHub's native Security tab via a standard `upload-sarif` step, so RedFlag CI gets dashboard-equivalent visibility for teams that want it without this project ever hosting or building one; the plain JSON export covers teams whose tooling doesn't consume SARIF; and the opt-in exit-code threshold lets a team choose to fail their own build on findings at a chosen severity, entirely on the consuming side. None of this touches RedFlag CI's own check run, which still reports only `success` or `neutral` and never `failure`, exactly as it always has.

#### How to use the exports

| Function | File | Returns |
|---|---|---|
| `formatFindingsAsSarif(findings)` | `src/exportSarif.ts` | SARIF 2.1.0 JSON string |
| `formatFindingsAsJson(findings)` | `src/exportJson.ts` | Plain JSON envelope string |
| `computeExitCode(findings, threshold?)` | `src/exitCodeThreshold.ts` | `0` or `1` |

All three take the same `Finding[]` that the PR-comment formatter already receives.

**`formatFindingsAsSarif`** produces a [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html)-compliant JSON string. SARIF is the format GitHub Code Scanning uses natively: upload a SARIF file and findings appear in the repository's **Security -> Code scanning** tab, with inline annotations on the diff and a queryable findings history -- without RedFlag CI needing to build or host any dashboard.

Schema mapping:
- `tool.driver.name` = `"RedFlag CI"`
- `tool.driver.rules` -- one entry per unique `detectorId`, not per finding
- Each finding -> one `results[]` entry: `ruleId` = `detectorId`, `level` = severity mapped (`high` -> `"error"`, `warning` -> `"warning"`, `info` -> `"note"`), `message.text` = `detail`
- `locations[0].physicalLocation.artifactLocation.uri` = `file`
- `region` is **omitted** -- the `Finding` interface carries no structured line/column fields today; detectors that locate a character embed position text in `detail` as prose rather than typed fields. No fabricated `1,1`.

**`formatFindingsAsJson`** produces a minimal JSON envelope for consumers that don't want SARIF's verbosity. No field renaming, no schema mapping -- all `Finding` fields pass through exactly as-is.

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

**`computeExitCode`** returns `1` if any finding meets or exceeds the given severity threshold, `0` otherwise. Severity ordering: `high > warning > info`. This function is advisory and consumer-side only. It does not change RedFlag CI's own check-run behavior, which always reports `success` or `neutral`, never `failure` (section 8: RedFlag CI reports, it never fails the build). Whether a finding should block a PR is a decision for your repo's own branch protection rules. `computeExitCode` is the mechanism for a team to enforce that in their own CI step, independently of this tool's GitHub App.

Opt-in by construction: if `threshold` is `undefined` (not passed), the function always returns `0`. There is no code path that produces a `1` without an explicit threshold.

```typescript
computeExitCode(findings);             // always 0 -- no threshold configured
computeExitCode(findings, 'high');     // 1 only if at least one high finding
computeExitCode(findings, 'warning');  // 1 if any high or warning finding
computeExitCode(findings, 'info');     // 1 if any finding at all
```

**Severity threshold reference:**

| Threshold | Exits 1 when... |
|---|---|
| `'high'` | At least one `high` finding |
| `'warning'` | At least one `high` or `warning` finding |
| `'info'` | Any finding at all |
| `undefined` (default) | Never -- always exits 0 |

**Worked example: GitHub Actions.** This snippet shows how a team would call RedFlag CI's exports from a separate job in their own workflow, upload the SARIF output to GitHub's Security tab, and optionally fail the job if any high-severity finding is present. The functions aren't called from the webhook pipeline, so this example invokes them via a small inline script step.

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
        # Runs even if the previous step exits 1 (if: always() keeps
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

This workflow builds and runs RedFlag CI in the workflow context, writes the two export files, uploads the SARIF to GitHub's Security tab (findings then appear as inline annotations on the diff and persist under **Security -> Code scanning**), and optionally exits with code 1 if the threshold is met, which marks the workflow job as failed, separately from RedFlag CI's own check run. The `category: redflag-ci` input distinguishes this SARIF upload from any other Code Scanning tool (CodeQL, Semgrep, and so on) running on the same repo; keep it stable across runs so GitHub accumulates a history under this category rather than creating a new series each time.

The 138-scenario benchmark corpus is unchanged by v2.0.0's own Phase A/B build, deliberately: it stayed single-PR-scoped by construction (one before/after file pair per scenario), and Phase A's stateful, sequential, webhook-timing-dependent behavior doesn't fit that shape. Cross-PR behavior is covered instead by integration tests exercising the real dispatch pipeline against a mocked baseline. See the [adversarial-tests repo's stress-testing notes](https://github.com/nikhilvirdi/redflag-ci-adversarial-tests/blob/main/STRESS_TESTING.md) for the full reasoning.

**Post-ship, v2.0.0 went through a full hardening audit (Stage 3)** before this roadmap was considered closed: a dependency and dead-code audit, an end-to-end code-review pass across every file in `backend/src`, a statement/branch coverage investigation, and a 23-scenario adversarial stress-test sweep built from two deliberately independent sources (one with full implementation knowledge, one working only from this document and the README). That pass is what added DD-8 above and closed a real bug in `suspiciousNetworkTarget.ts`'s bare-IP exemption, among other fixes -- the benchmark corpus grew from 138 to 139 scenarios as a direct result (DD-8's own scenario), precision and recall unchanged at 1.000/1.000. The complete breakdown of what was found, fixed, and deliberately left alone is in the [adversarial-tests repo's transparency report](https://github.com/nikhilvirdi/redflag-ci-adversarial-tests/blob/main/TRANSPARENCY_REPORT.md), not restated here.

### What was scoped and explicitly rejected, not deferred

An earlier draft of this roadmap planned four major versions: v2 as an opt-in LLM adjudication tier, v3 as Postgres-backed persistence and broader file coverage, and v4 as MCP behavioral scanning, auto-fix PRs, SARIF export, and a dashboard. After scrutiny, most of that was cut, not postponed:

- **LLM adjudication tier and a custom-trained ML model (both considered, both rejected).** Either would abandon the deterministic, zero-noise design this entire project is built around, and would duplicate ground already claimed by funded, cloud-based semantic scanners (Invariant Guardrails, MCP-Guard) rather than defending RedFlag CI's actual differentiator. Nearly every concrete gap this tier was meant to close (the uncommon-homoglyph miss, the legitimate-multilingual-text false positive) turned out to have a deterministic fix instead -- see v1.2.0 above.
- **Full Postgres persistence and a trend dashboard.** Cut for the same reason: v1 explicitly names "no dashboard" as a design principle, so a database backing trend data nobody's UI displays is pure unused surface area, and it breaks the zero-config, install-and-it-works promise the whole project is positioned on. The one genuinely real gap this was meant to close -- cross-PR drift -- survives, but is solved the lightweight way in v2.0.0's Phase A instead, with no database and no hosting requirement.
- **MCP server behavioral/semantic scanning.** Cut. This requires actually running MCP servers to observe their behavior, which is both a real safety risk (see the [adversarial-tests repo's comparison notes](https://github.com/nikhilvirdi/redflag-ci-adversarial-tests/blob/main/benchmark/COMPARISON.md) for a discussion of why that comparison declined to execute untrusted servers) and already well-covered ground (mcp-scan, AgentShield), per section 3.
- **Auto-fix PRs.** Cut. Auto-generating code changes is a different trust model than flagging a risk (act vs. inform), a materially larger liability surface, and crowded, funded territory (CodeRabbit, Greptile) RedFlag CI was never trying to compete on.
- **SARIF export survives, narrowed.** Of the original v4 scope, only this earns its place, and it moves into v2.0.0 Phase B rather than staying a hypothetical fourth tier, since it's an output format on top of existing findings, not new detection logic or new infrastructure.

**Deprecation policy:** every version from v1.2.0 onward is additive; nothing added in a later version changes what an earlier version already does by default. v1.2.0's new detectors run by default (they're the same category as v1's existing ones). v2.0.0's cross-PR memory and export options are additive on top of that.

## 11. Explicit non-goals (permanent, not deferred)

- No whole-repository indexing or cross-file taint analysis. Established during research to be technically unreliable at PR-diff scope; see section 2.
- No hallucinated-package or slopsquatting detection. Already well covered by existing tools (Socket.dev, Aikido SafeChain); adding it here would duplicate, not differentiate. See section 3.
- No auto-fix, at any point in this project's roadmap. Considered for what was originally planned as v4 and explicitly rejected; see section 10.
- No hosted dashboard or UI, at any point in this project's roadmap. v2's SARIF export gives teams that want a dashboard a path to GitHub's own Security tab instead of this project building one.
- No LLM calls, no ML models, no semantic reasoning, at any point in this project's roadmap. Considered for what was originally planned as v2 and explicitly rejected; see section 10.

## Appendix A: ADR 0001 -- Deterministic-only detection for v1 (precision over recall)

### Context

The research behind RedFlag CI's scope (section 2) identifies two separate problems, and only one of them was allowed to drive v1's architecture.

The first is that agent configuration is a real, actively-exploited attack surface: CVE-2025-59536 (malicious Claude Code hooks), CVE-2025-54136 / MCPoison (silently repointing an already-approved MCP server), and independent research demonstrating invisible Unicode injected into rule files like `CLAUDE.md`. This part motivates building the tool at all.

The second problem is the one that actually shaped v1's design: noise. Section 2 documents that the dominant complaint across every AI code-review tool on the market is false positives, with reported rates "as high as 87% in some evaluations," and up to 40% of AI-generated review comments ignored outright regardless of correctness. Developer sentiment describes these tools as producing "pure noise" to the point of contradicting their own prior suggestions. The consequence stated there is direct: "a tool that finds real issues but drowns them in false ones gets muted within a week, and the security benefit disappears along with it."

That single fact -- a noisy tool is a dead tool, regardless of what it can theoretically detect -- is why precision, not recall, is the binding constraint for v1. A design that catches more attack patterns but erodes trust faster than it builds it is a net loss under this project's own stated goals. Every other v1 decision (deterministic-only, fail-open, zero-config, stateless) is downstream of this one.

### Decision

v1 detects risky agent-config changes using six deterministic detectors only: no LLM calls, no ML models, no semantic or natural-language reasoning anywhere in the pipeline (section 4). Every detector is a plain function that takes file content (and, for the diff-drift engine, a before/after pair) and returns a list of findings via fixed character-class checks, JSON structural comparisons, and set operations:

- **DD-1 through DD-4** (diff-drift engine): new MCP server added, pinned command/args/version swapped on an existing server (the MCPoison pattern), permission or allow-list widened, hook added or changed (the CVE-2025-59536 pattern).
- **RF-1 and RF-2** (rule-file engine): invisible/bidirectional-control Unicode characters, and a fixed table of Cyrillic/Greek characters that are visually identical to Latin ones.

This is stated in section 4 as an explicit, named tradeoff, not an implementation shortcut to be upgraded later without comment: "RedFlag CI will miss cleverly obfuscated attacks that don't rely on invisible characters or an obvious permission change. That's an accepted tradeoff, not an oversight. A tool developers trust because it's quiet is more valuable than one that's thorough but gets muted after a week."

Determinism is also what makes v1's other properties possible: the tool is stateless (no database, no persisted baseline -- the base branch fetched fresh on every run is the only "memory" it needs), and its output is fully reproducible given the same two file versions. Neither property would hold if a detector's output depended on a model call.

### Consequences

The first measurement of this decision ran an 18-scenario synthetic benchmark ([corpus](https://github.com/nikhilvirdi/redflag-ci-adversarial-tests/tree/main/benchmark/corpus/), [results](https://github.com/nikhilvirdi/redflag-ci-adversarial-tests/blob/main/benchmark/RESULTS.md)), covering all six detectors, four genuinely benign changes, five near-miss cases designed to stress false positives, and one case designed to stress a false negative. The corpus was built to surface real limits, not to look clean, and no detector logic was adjusted afterward to improve the numbers.

**Actual result: Precision = 0.727, Recall = 0.889** (8 true positives, 3 false positives, 6 true negatives, 1 false negative, out of 18 scenarios).

These are real numbers from a small, deliberately adversarial corpus, not a statistically representative sample of production traffic -- but they are the only empirical evidence this project had at that stage, and they say plainly that the precision-over-recall tradeoff has a measurable, non-trivial cost, not a hypothetical one.

#### The three false positives, without minimizing them

**Arg-reorder on an MCP server (`near-miss-args-reorder`).** Two independent CLI flags on an already-approved server were reordered with no behavioral change; DD-2 flagged it as a definition change anyway. This traces to a deliberate design choice in `swappedMcpServer.ts`: array comparison is order-sensitive because a reorder of *positional* CLI arguments can change execution semantics, and the detector has no way to know whether a given argument is positional or an order-independent flag. The choice to treat all reorders as drift is defensible, but it does produce a real false positive on a real, benign refactor pattern.

**A legitimate Russian sentence triggering the homoglyph detector (`near-miss-legit-cyrillic-text`).** Adding one genuine, non-malicious sentence of Russian-language documentation to `CLAUDE.md` produced **nine separate RF-2 findings** in a single run -- one per matching Cyrillic letter. RF-2 is a pure character-class check with no natural-language awareness by design (section 7: "no natural-language interpretation, no judgment calls"). It cannot distinguish a single homoglyph smuggled into otherwise-Latin text from an entire sentence legitimately written in Cyrillic, because at the character level those two things are identical. This is not an edge case that happens to exist somewhere in Unicode; it is the direct, structural consequence of how RF-2 works, and it will reproduce on any repository whose `CLAUDE.md`, `.cursor/rules/*`, or `copilot-instructions.md` contains legitimate non-Latin-script content -- localization notes, contributor names, translated examples.

**An MCP server rename triggering DD-1 (`near-miss-mcp-server-rename`).** Renaming an existing server's key while leaving its command and args byte-for-byte identical was flagged as a brand-new, unreviewed server. DD-1 diffs purely by key name (per its spec: "any entry present in head but absent from base is a finding"), so it structurally cannot distinguish a rename of a trusted entry from a genuinely new one.

#### The one false negative, and the RF-2 qualification it points to

An uncommon Cyrillic homoglyph (U+0501) substituted into an otherwise-Latin word went undetected, because it wasn't in RF-2's original hand-picked confusables table. This directly qualifies section 7's "near-zero false-positive rate" claim for the rule-file engine: that claim is true in the sense that RF-1 and RF-2 make no judgment calls and never misfire on an actual attack pattern they check for, but it is not true in the sense of "catches every possible homoglyph" -- RF-2's coverage is only as complete as its confusables table, and a character outside that table is invisible to it, not flagged with lower confidence.

This decision was originally written expecting to be superseded in scope, not overridden, once an opt-in LLM adjudication tier shipped in a later version. That tier was reconsidered and rejected before being built -- see the addendum below for why. This ADR's reasoning is this project's permanent position, not a placeholder pending a future upgrade.

### Addendum: benchmark expansion and fixes (2026-08-06)

The 18-scenario corpus above was the first measurement of this decision, not the last. Before considering v1 ready to rely on, the corpus grew to 120 scenarios across six rounds of deliberate stress-testing, aimed specifically at finding edge cases the original 18 didn't cover: deeper per-detector coverage, explicit judgment calls, fail-open behavior under malformed input, realistic scale, unusual character encodings, multiple detectors colliding on one change, and adversarial evasion attempts.

That expansion did its job. It surfaced one real detector defect during construction -- DD-3's wildcard-escalation check was a plain substring match, so it flagged any permission containing a literal asterisk as an unrestricted grant, including narrow, legitimate glob-scoped paths like `Read(src/**)`. That was fixed immediately, since it was a genuine bug rather than a documented tradeoff. Once the full 120-scenario run was complete, it also surfaced five further gaps, none of them bugs in the sense of the code failing its own spec, but real, fixable limits worth closing anyway:

- RF-1 was missing two invisible characters with no legitimate reason to appear in an instruction file: the soft hyphen and the standalone right-to-left mark.
- RF-2's confusable table didn't cover fullwidth Latin letters, mathematical alphanumeric symbols, Armenian, or Cherokee -- four entire scripts of Latin look-alikes.
- DD-2 compared command, arguments, and version, but not environment variables, even though an env-var swap carries the same MCPoison-shaped risk as a command swap.
- DD-3 recognized `Bash(*)` as an unrestricted grant but not the equally broad `Bash` with no arguments at all, since that shape contains no literal asterisk.
- DD-4 had no whitespace normalization on hook-command comparison, and never compared a hook's matcher/trigger scope, only its command.

All five were fixed, each verified individually against the specific scenario that found it, with the rest of the test suite confirmed unaffected. Section 7 was updated to reflect DD-2's and DD-4's expanded scope. Re-running the full 120-scenario corpus afterward: **precision rose to 0.926, recall to 0.949** (see the [full results](https://github.com/nikhilvirdi/redflag-ci-adversarial-tests/blob/main/benchmark/RESULTS.md)).

What this addendum does not claim: the three false positives and one false negative documented above, in the original 18-scenario run, are unchanged. The arg-reorder, legitimate-Cyrillic-text, and server-rename false positives are still there, for the same structural reasons already given -- fixing them would mean DD-1/DD-2 correlating removals with additions, or RF-2 gaining natural-language awareness, both of which remain the kind of judgment call this decision keeps out of v1's deterministic detectors. The RF-2 qualification to the "near-zero false-positive rate" claim, above, also still stands; it was not addressed by this round and remains open for whoever next revises that section.

### Addendum: the roadmap's LLM tier was reconsidered and rejected, not built (2026-08-07)

Section 10's original plan named four major versions, with v2 as an opt-in, BYOK LLM adjudication tier meant to close exactly the kind of gap this ADR documents above: the uncommon-homoglyph false negative and the legitimate-multilingual-text false positive. Before that tier was scoped or built, the plan was revisited directly against this ADR's own findings, and rejected, for reasons consistent with everything already argued above rather than in tension with it:

- **Almost every gap the LLM tier was meant to close turned out to have a deterministic fix instead.** The uncommon-homoglyph miss closes by adopting Unicode's official confusables table in place of the hand-picked one -- a bigger, standard table instead of a smarter model. The legitimate-Cyrillic-text false positive closes with a per-word script-majority heuristic: a word that's mostly one non-Latin script is treated as real language, and a word that's Latin except for one substituted character is treated as a probable attack. Both fixes are scoped into v1.2.0 (see `workplan.md`), and both stay explainable in the same way every existing detector already is: the finding can be traced to a specific rule, not a model's confidence score.
- **A custom-trained ML model was considered as a lighter-weight alternative to a full LLM tier, and rejected for the same underlying reason.** It would still trade an explainable rule for a statistical judgment, still requires a labeled training set this project doesn't have (the 120-scenario benchmark is a test set, not remotely enough to train on), and still reopens the "why did it flag this" problem RF-1 and RF-2 currently don't have.
- **The remaining gap that isn't closeable this way is cross-PR gradual drift.** This was always a memory problem, not something an LLM tier would have solved either. It's addressed in v2 instead, with a lightweight git-native baseline snapshot -- not persistence at the scale originally planned for v3, and not any form of AI.

The net effect: v2 no longer means what the original roadmap draft said it meant. Full detail on the revised roadmap, including what else was cut (Postgres persistence, MCP behavioral scanning, auto-fix PRs, a hosted dashboard) and what survived in a lighter form (SARIF/JSON export, folded into v2 Phase B), lives in section 10. This ADR's core position is unchanged and, if anything, more firmly established by this review than it was at v1.0.0: RedFlag CI's deterministic-only design is this project's permanent architecture, not a v1-only starting point waiting to be upgraded.

### Addendum: v2.0.0 ships stateful memory without abandoning the deterministic-only decision (2026-08-08)

This project's roadmap closed with v2.0.0, the final planned version (section 10). Two things worth checking against this ADR's original decision before calling it settled: does Phase A's cross-PR drift memory reintroduce the kind of non-determinism this document exists to rule out, and does Phase B's export tier change anything about detection itself. Neither does, and it's worth stating plainly why rather than assuming it from the version number alone.

**Phase A adds state, not non-determinism.** The distinction this ADR actually cares about, from the start, was never "does the tool remember anything" -- it was "does a detector's output depend on anything other than a deterministic function of its inputs" (an LLM call, a trained model, anything that could return a different answer on the same input on a different day). A git-native baseline snapshot doesn't touch that: given the same stored baseline content and the same head content, `detectCumulativeDrift` returns the same result every time, exactly like every other detector in this project. What changed is where one input comes from -- a stored snapshot instead of a freshly-fetched base branch -- not whether the comparison itself is deterministic. The snapshot's own correctness is protected the same way everything else in this project is protected: fail-open on any read failure, an integrity hash to catch tampering, merge-only writes to keep an unmerged PR from ever influencing it. None of that is new judgment; it's the same fail-open, precision-over-recall discipline this ADR already committed to, extended to cover a new kind of input.

**Phase B doesn't touch detection at all.** SARIF export, JSON export, and the opt-in exit-code threshold are pure serializations of findings the deterministic detectors already produced. They introduce no new judgment calls, no new false-positive surface, nothing this ADR's reasoning needs to account for.

**What this confirms, now that the roadmap is closed:** the original v2 draft planned an opt-in LLM adjudication tier specifically for this version, documented in this ADR's second addendum as reconsidered and rejected before being built. The version that actually shipped as v2.0.0 gained a real, meaningful new capability (memory across pull requests) without needing that tier at all, and without compromising the deterministic-only commitment this document opened with. That's not a coincidence this ADR is claiming credit for after the fact; it's the direct, intended result of treating "deterministic-only" as this project's permanent architecture from v1.0.0 onward, not a v1-specific starting point that later versions would eventually need to loosen.

This project's roadmap is closed at v2.0.0. No further versions are planned. This ADR's core decision -- deterministic-only, precision over recall, no LLM or ML calls anywhere in the pipeline -- held from the first detector in v1.0.0 through the last feature shipped in v2.0.0, without a single exception.
