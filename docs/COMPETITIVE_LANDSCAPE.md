# Competitive Landscape

This records what already exists in the AI-code-security space, and exactly where RedFlag CI's scope does and doesn't overlap with it. The goal is to be honest about what's already solved rather than assume a gap exists just because it wasn't found on the first pass.

## What's already commoditized (and deliberately out of scope here)

**Hallucinated packages and slopsquatting.** Socket.dev ships a free GitHub App that flags suspicious new dependencies directly on a pull request. Aikido's SafeChain wraps npm, yarn, and pnpm to block known-bad installs before they happen. Between the two, this problem already has solid, freely available coverage. RedFlag CI doesn't attempt it.

**Auto-fix and general AI-generated application code review.** This category is both crowded and well funded: CodeRabbit raised a $60M Series B, Greptile reached a $180M valuation, and dedicated AI-native security platforms like OX Security's VibeSec and Backslash Security (a $19M Series A) are already targeting this exact problem, in some cases pushing detection earlier than PR time, into the code-generation step itself. RedFlag CI isn't trying to out-build funded competitors on their own turf.

## What's closer to RedFlag CI's actual territory

Direct-source review turned up several tools already working on agent-config and MCP security specifically, which is worth stating plainly rather than glossing over:

- **AgentShield**, built during a February 2026 Anthropic hackathon, ships as a CLI, a GitHub Action, and a GitHub App, and already scans `.claude/` configuration, MCP servers, and hooks, with baseline and drift-gating features.
- **mcp-scan** (Invariant Labs) is close to a category standard for detecting tool poisoning and rug-pull attacks against MCP servers, with both static and proxy modes.
- **Snyk** ships its own open-source agent/skill scanner, and **MCPShield** and **eSentire's MCP-Scanner** cover overlapping ground.

So the honest framing is: PR-time scanning of agent configuration is not virgin territory. What's left is narrower, but still real.

## The gap that's actually still open

Two structural problems show up across nearly every existing tool in this space, regardless of which company built it:

**Pattern-based scanners are fast and local, but noisy.** Static, rule-based detection (the approach behind tools like Cisco's mcp-scanner) produces false-positive rates as high as 78% in practice, largely because MCP tool descriptions are full of ordinary imperative language ("call this tool," "run this query") that a blunt pattern match can't distinguish from an actual attack.

**LLM-based scanners are more accurate, but leave the local machine.** Tools like Invariant Guardrails and academic systems like MCP-Guard get meaningfully better accuracy by reasoning semantically, at the cost of sending configuration data to a cloud service, adding latency, and adding a per-scan token cost.

Nobody has combined low-noise, fully local, and PR-native in one tool. That combination is RedFlag CI's actual target, and it shapes four concrete decisions:

1. **Diff-aware, not single-shot.** Every existing tool checked here evaluates a config file's current state. None of them treat "what changed since the base branch" as the primary signal. RedFlag CI's diff-drift engine (`architecture.md` section 5) is built around exactly that: a new MCP server, a swapped tool, a widened permission, a new hook, are all diff facts, not judgment calls.
2. **A separate, distinct detection problem: rule-file injection.** Existing tools concentrate on MCP server behavior and tool descriptions. Hidden-character injection in `CLAUDE.md`, `.cursor/rules`, and Copilot instruction files is a different attack surface, and it's covered here as its own detector pair rather than an afterthought.
3. **Deterministic by construction, not by tuning.** Instead of trying to tune a pattern-matcher down to an acceptable false-positive rate, RedFlag CI's v1 detectors are restricted to checks that are true-or-false by definition: a character is present or it isn't, an entry was added or it wasn't. This sidesteps the precision problem instead of chasing it.
4. **Built for the developer opening the PR, not the security team opening a dashboard.** No SARIF, no posture score, no separate UI in v1. One comment, when there's something worth saying.

## What this doesn't guarantee

None of the above is a permanent moat on its own. AgentShield in particular could plausibly add diff-awareness without much difficulty. The more durable advantage is the combination and the restraint behind it: staying quiet on unaffected PRs, refusing to chase recall at the cost of trust, and building the drift engine as the actual technical center of the project rather than a checkbox feature. That's a product-design choice as much as a technical one, and it's the thing worth defending as the project grows.