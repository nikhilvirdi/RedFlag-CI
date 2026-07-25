# Problem Space

This is a condensed record of the research behind RedFlag CI's scope. It exists so anyone reading the code later, including future agents working on this repo, understands why the tool is shaped the way it is rather than treating `architecture.md` as an arbitrary set of choices.

## AI-generated code ships with more security flaws, at higher volume

Veracode's 2025 GenAI Code Security Report found that a large share of AI-generated code, on the order of 41 to 62% depending on methodology, introduces at least one security vulnerability. Separately, CodeRabbit's analysis of AI-coauthored pull requests found close to double the issue rate of human-written PRs overall, and nearly triple for certain vulnerability classes like cross-site scripting. Georgia Tech's Vibe Security Radar, which traces CVEs directly back to AI-generated code using commit metadata, recorded 6 such CVEs in January 2026, 15 in February, and 35 in March, a trajectory the researchers describe as a lower bound, since developers frequently strip the metadata that makes attribution possible.

## Agent configuration is a new and largely unguarded attack surface

The Model Context Protocol, which standardizes how AI agents read external tools and context, grew to tens of millions of monthly downloads and thousands of public servers within about a year of its release. Security practice didn't keep pace. Independent audits found the large majority of tested MCP servers vulnerable to path traversal, a substantial share vulnerable to command injection or server-side request forgery, and hundreds of servers exposed to the open internet with no authentication at all.

The incident record is concrete, not hypothetical:

- CVE-2026-25253, the first CVE ever assigned to an agentic AI system, was quickly followed by the ClawHavoc campaign, which planted malicious agent skills into a public marketplace and used them to distribute credential-stealing malware.
- CVE-2025-59536 exploits Claude Code's hooks by injecting a malicious hook into `.claude/settings.json`.
- CVE-2025-54136, known as MCPoison, achieves persistent remote code execution by swapping a trusted, already-approved MCP configuration for a malicious one.
- CVE-2025-6514, a critical (CVSS 9.6) command-injection bug in a widely used MCP package, was downloaded over 400,000 times before disclosure.
- Researchers have separately demonstrated invisible Unicode characters injected into rule files like `CLAUDE.md` and `.cursor/rules`, silently directing an agent to embed malicious code in everything it generates afterward, with nothing visible in a normal diff view.

## The bigger, separate problem: noise

Independent of what a tool can technically detect, the dominant complaint across every AI code-review tool on the market is the same: too many false positives. Reported rates run as high as 87% in some evaluations, and up to 40% of AI-generated review comments get ignored outright. Developer sentiment on forums like Hacker News describes these tools as producing "pure noise," to the point that some reviewers contradict their own prior suggestions when a developer implements the exact fix they recommended.

This matters more than it might first appear. A tool that finds real issues but drowns them in false ones gets muted within a week, and the security benefit disappears along with it. Any credible design in this space has to treat noise as a first-class constraint, not an acceptable side effect of thoroughness.

## Why PR-diff-time analysis has a real ceiling

Vulnerability chaining, tracing a tainted input through to an exploitable sink, requires visibility into code that may live entirely outside the current diff. If the sink is in the PR but the source lives in a file nobody touched, a diff-only tool structurally cannot see the connection. This isn't a tooling gap that better engineering closes; ASPM vendors and reachability-analysis researchers are consistent on this point. It's the reason RedFlag CI doesn't attempt general vulnerability chaining, and instead scopes itself to detections that genuinely fit within a diff's boundaries: a file changed, an entry added, a character that shouldn't be there.

Static detection of prompt-injection paths runs into the same ceiling. Academic work in this area (including a 2026 paper evaluating static dataflow analysis for exactly this problem) confirms it's technically real, but only when the full source-to-sink path is visible to the analyzer. When prompt construction spans multiple files or services, which it usually does, a PR-diff-scoped tool can't reliably trace it. Claims that a diff-only tool can autonomously map these paths are, at this point, mostly marketing language rather than demonstrated capability.