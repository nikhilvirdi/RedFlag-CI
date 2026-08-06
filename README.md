# RedFlag CI

<img width="1369" height="339" alt="RedFlag-CI Dark Theme Logo" src="https://github.com/user-attachments/assets/ad35a7f3-71ee-494c-8b32-ea207069ae8a" />


RedFlag CI is a GitHub App that watches pull requests for risky changes to your AI agent configuration, before those changes get merged.

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

## What it doesn't do, yet

No dashboard. No auto-fix. No LLM-based semantic analysis. Those are on the roadmap (see `architecture.md`), but v1 is deliberately narrow: a small, deterministic tool that does one job well before it tries to do five jobs adequately.

## Status

v1 is complete and running. All six detectors work end to end, from a GitHub webhook to a posted PR comment and check run, verified against a real pull request on a live repository. It's also been stress-tested against a 120-scenario adversarial benchmark, built specifically to find the tool's real limits -- see `docs/STRESS_TESTING.md` for what that testing found and `docs/adr/0001-deterministic-only-v1.md` for what the numbers below actually mean.

| Version | Precision | Recall | Benchmark corpus |
|---|---|---|---|
| v1.0.0 | 0.727 | 0.889 | 18 scenarios |
| v1.1.0 | 0.926 | 0.949 | 120 scenarios |

Full breakdown: `backend/benchmark/RESULTS.md`.

## Documentation

- `architecture.md`: full system design, every detector, every decision, and the roadmap through v4
- `docs/PROBLEM_SPACE.md`: the research behind why this exists
- `docs/COMPETITIVE_LANDSCAPE.md`: what else is out there, and where the gaps are
- `docs/adr/0001-deterministic-only-v1.md`: why v1 is deterministic-only, and what that costs in practice
- `docs/STRESS_TESTING.md`: how the benchmark grew from 18 to 120 scenarios, and what it found
- `backend/benchmark/RESULTS.md`: the full benchmark corpus and results
- `backend/benchmark/COMPARISON.md`: a live comparison against Snyk Agent Scan (formerly mcp-scan)

## License

MIT. See `LICENSE`.