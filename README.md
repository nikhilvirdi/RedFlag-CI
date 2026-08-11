# RedFlag CI

<img width="1369" height="339" alt="RedFlag-CI Dark Theme Logo" src="https://github.com/user-attachments/assets/ad35a7f3-71ee-494c-8b32-ea207069ae8a" />


RedFlag CI is a GitHub App that watches pull requests for risky changes to your AI agent configuration, before those changes get merged.

**Latest release: [v2.0.0](https://github.com/nikhilvirdi/RedFlag-CI/releases/tag/v2.0.0)** -- the project's final planned version. See the release page for the full writeup, or `TRANSPARENCY_REPORT.md` in this repo for the post-ship audit behind it.

## Why this exists

AI coding agents like Claude Code, Cursor, and Copilot read instructions from files sitting in your repo: `.mcp.json`, `.claude/settings.json`, `CLAUDE.md`, `.cursor/rules`. Those files decide what tools an agent can call, what permissions it has, and what instructions it follows on every future run.

That makes them a supply chain, and a pull request is where that supply chain actually changes. A PR that adds a new MCP server, widens a permission, or swaps a pinned tool version can quietly change what your agent is allowed to do. A rule file with a hidden Unicode character can inject instructions that no reviewer will ever spot by reading the diff on GitHub.

2026 has already produced real incidents here: CVE-2026-25253, the first CVE ever assigned to an agentic AI system; the ClawHavoc campaign, which planted over a thousand malicious agent skills into a public marketplace; and CVE-2025-6514, a critical remote-code-execution bug in a widely used MCP package. Most existing scanners either run locally on your own machine or surface findings in a security dashboard that nobody outside the AppSec team opens. Neither shows up where a developer is actually looking: the pull request.

## What it does

RedFlag CI runs two checks. Both are fully deterministic, no LLM calls, no network access beyond GitHub's own API.

**Diff-drift detection.** On any PR touching an MCP or agent-config file, it compares the base branch to the head branch and flags:

- a new MCP server being added
- a pinned tool, command, or version being swapped for a different one
- a permission or allow-list being widened, or a deny rule being removed
- a hook being added or changed

**Rule-file scanning.** On any PR touching `CLAUDE.md`, `.cursor/rules`, or `.github/copilot-instructions.md`, it checks for invisible Unicode characters (zero-width spaces, bidirectional overrides) and homoglyphs (Cyrillic or Greek characters that look identical to Latin ones). Both are known techniques for hiding instructions inside a file that looks completely normal in a GitHub diff.

If a PR doesn't touch any of these files, RedFlag CI does nothing: no comment, no noise. That's deliberate. The most common complaint about existing AI-code review tools is alert fatigue; some report false-positive rates as high as 87%. RedFlag CI would rather miss something subtle than train you to ignore it.

## Key features

- **Thirteen deterministic detectors**, covering agent-config drift (new MCP servers, swapped tools, widened permissions, hook changes, unpinned dependencies, obfuscated commands, duplicate keys, suspicious network targets, path traversal, transport-type changes, monitored-file deletion) and rule-file injection (invisible Unicode, homoglyphs) -- see `architecture.md` for the exact behavior of each.
- **No LLM calls, anywhere in the pipeline.** Every check is a plain function over file content, so a given diff always produces the same result. Nothing here depends on a model call succeeding, staying consistent, or costing you tokens.
- **Fail-open by design.** A malformed or unparseable config file is skipped, not blocked. RedFlag CI would rather miss a broken file than break your build.
- **Zero-config install.** No dashboard, no settings screen, nothing to configure beyond installing the app. It works the moment it's on your repo.
- **Quiet by default.** No comment posts unless there's an actual finding. A PR that doesn't touch a monitored file gets no response at all -- silence is part of the product, not a gap in coverage.
- **Least-privilege permissions.** The GitHub App requests `contents:read`, `pull_requests:write`, and `checks:write`. Nothing broader.
- **Never blocks a merge.** Check runs report `success` or `neutral`, never `failure`. Whether a finding should block a PR is a decision for your repo's own branch protection rules, not something this tool imposes.
- **Benchmarked, not just claimed.** A 139-scenario adversarial test corpus backs the precision and recall numbers below, with every known limitation documented openly rather than hidden. See `docs/STRESS_TESTING.md`.

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js, TypeScript (strict mode) |
| Server | Express 5 |
| GitHub integration | `@octokit/app`, `@octokit/rest` |
| Payload validation | Zod |
| Testing | Jest, Supertest |
| Logging | Winston, Morgan |
| Packaging | Docker |
| CI | GitHub Actions |

## What it doesn't do, and why

No dashboard. No auto-fix. No LLM-based or ML-based semantic analysis, anywhere in the roadmap. These weren't left out for lack of time -- they were considered and deliberately rejected, because each one would trade away the thing that makes this tool different: deterministic, zero-noise, zero-config detection. `architecture.md` section 8 has the full reasoning.

Two things that used to be listed here as "still planned" have since shipped, in v2.0.0, the project's final version: memory of drift across multiple pull requests (still no database -- a small git-native snapshot, not a hosted service), and SARIF/JSON export so teams that want a dashboard can get one for free via GitHub's own Security tab, without this project building one. With v2.0.0 shipped, this roadmap is closed -- there's nothing left planned beyond what's already built. See `CHANGELOG.md` for exactly what shipped, and `docs/EXPORTS.md` for how to use the export functions.

## Status

v2.0.0 is complete -- the project's final planned release, since hardened by a full post-ship audit (Stage 3; see `TRANSPARENCY_REPORT.md`). The core pipeline (thirteen detector IDs total: the original six, six new ones added in v1.2.0 -- RF-1/RF-2's JSON-key extension reuses existing IDs rather than adding new ones, see `architecture.md` §5 -- plus DD-8, added during Stage 3's audit to catch a monitored file's outright deletion) works end to end, from a GitHub webhook to a posted PR comment and check run, verified against a real pull request on a live repository at v1.0.0. It's also been stress-tested against a 139-scenario adversarial benchmark, built specifically to find the tool's real limits -- see `docs/STRESS_TESTING.md` for what that testing found and `docs/adr/0001-deterministic-only-v1.md` for what the numbers below actually mean. v2.0.0's own additions since that live run -- cross-PR drift memory, the export functions, and Stage 3's fixes to existing detectors -- are validated by the automated test suite (unit tests against a mocked Octokit, plus integration tests exercising the full webhook-to-comment pipeline) and, for Stage 3 specifically, a dedicated 23-scenario adversarial stress-test sweep (`backend/STRESS_TEST_FINDINGS.md`), rather than that same live-repository run; `docs/STRESS_TESTING.md`'s new section explains why cross-PR behavior specifically is tested that way instead of via the benchmark corpus.

| Version | Precision | Recall | Benchmark corpus |
|---|---|---|---|
| v1.0.0 | 0.727 | 0.889 | 18 scenarios |
| v1.1.0 | 0.926 | 0.949 | 120 scenarios |
| v1.2.0 | 1.000 | 1.000 | 138 scenarios |

v2.0.0 shipped against this same 138-scenario corpus, unchanged at first: Phase A's cross-PR drift memory is a stateful, sequential, webhook-timing-dependent feature that doesn't fit the corpus's single-PR-scoped format, so it's covered instead by integration tests exercising the real pipeline (`docs/STRESS_TESTING.md` explains why in full). Stage 3's post-ship audit grew the corpus by one scenario after that -- `dd8-monitored-file-deleted`, covering the new DD-8 detector -- bringing it to 139. Precision and recall stayed at 1.000/1.000 throughout.

This table is now complete: v2.0.0 is the project's last planned version, and no future release will grow the corpus for one. Stage 3's one-scenario addition, above, came from hardening an already-shipped release, not from a new version.

Full breakdown: `backend/benchmark/RESULTS.md`.

## Getting started

RedFlag CI is self-hosted: there's no public, one-click install yet, since this project hasn't been published to the GitHub Marketplace. Running it on your own repository means registering your own GitHub App and pointing it at a webhook endpoint you control.

**1. Clone and install**

```bash
git clone https://github.com/nikhilvirdi/RedFlag-CI.git
cd RedFlag-CI/backend
npm install
```

**2. Register a GitHub App**

Go to **GitHub Settings → Developer settings → GitHub Apps → New GitHub App**, and set:

- **Webhook URL**: wherever you're running the service (a public URL, or a tunnel like ngrok for local testing), pointing at the app's webhook endpoint
- **Webhook secret**: any random string -- you'll need this again in the next step
- **Repository permissions**: `Contents: Read-only`, `Pull requests: Read & write`, `Checks: Read & write` -- nothing broader
- **Subscribe to events**: `Pull request`

After creating the app, note the **App ID**, generate a **private key** (downloads a `.pem` file), and install the app on the repository you want it to watch.

**3. Configure environment variables**

Create a `.env` file in `backend/`:

```
GITHUB_APP_ID=your_app_id
GITHUB_WEBHOOK_SECRET=the_secret_from_step_2
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...contents of the .pem file...
-----END RSA PRIVATE KEY-----"
```

**4. Build and run**

```bash
npm run build
node dist/index.js
```

The service listens on port 3000 by default. Once it's running and reachable at the webhook URL you configured, RedFlag CI is live: open a pull request that touches one of the monitored files (see `architecture.md` section 4 for the full list) on the repo you installed it on, and it'll comment if it finds something worth flagging.

## Documentation

| File | What's in it |
|---|---|
| [`architecture.md`](architecture.md) | Full system design: every detector, every decision, the complete roadmap through v2.0.0, the project's final release |
| [`docs/PROBLEM_SPACE.md`](docs/PROBLEM_SPACE.md) | The research behind why this exists |
| [`docs/COMPETITIVE_LANDSCAPE.md`](docs/COMPETITIVE_LANDSCAPE.md) | What else is out there, and where the gaps are |
| [`docs/adr/0001-deterministic-only-v1.md`](docs/adr/0001-deterministic-only-v1.md) | Why v1 is deterministic-only, and what that costs in practice |
| [`docs/STRESS_TESTING.md`](docs/STRESS_TESTING.md) | How the benchmark grew from 18 to 139 scenarios, and what it found |
| [`backend/benchmark/RESULTS.md`](backend/benchmark/RESULTS.md) | The full benchmark corpus and results |
| [`backend/benchmark/COMPARISON.md`](backend/benchmark/COMPARISON.md) | A live comparison against Snyk Agent Scan (formerly mcp-scan) |
| [`docs/EXPORTS.md`](docs/EXPORTS.md) | v2.0.0's SARIF/JSON export and exit-code-threshold functions, and a worked GitHub Actions example |
| [`TRANSPARENCY_REPORT.md`](TRANSPARENCY_REPORT.md) | The post-ship Stage 3 audit: dependency and dead-code checks, a full code-review pass, a coverage investigation, and a 23-scenario adversarial stress-test sweep |
| [`backend/STRESS_TEST_FINDINGS.md`](backend/STRESS_TEST_FINDINGS.md) | Stage 3's stress-test sweep, scenario by scenario, with real output |
| [`CHANGELOG.md`](CHANGELOG.md) | What shipped in each version |
| [`SECURITY.md`](SECURITY.md) | How to report a vulnerability, and the tool's own security scope |

## License

MIT. See `LICENSE`.