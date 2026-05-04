# Architectural Decisions

## [2026-05-03] BullMQ over simple async for scan jobs
Reason: need retry with exponential backoff, deduplication by job ID, and concurrency control.
Settled: yes.

## [2026-05-03] Redis is required, not optional
Reason: BullMQ requires Redis. Rate limiting uses Redis. OAuth state will move to Redis.
Settled: yes.

## [2026-05-03] Python scan engine over pure Node.js
Reason: Semgrep, Checkov, TruffleHog are Python/CLI tools. Python AST parsing is mature.
Communication: stdin/stdout JSON contract.
Settled: yes.

## [2026-05-03] pgvector over Pinecone or Weaviate for embeddings
Reason: zero additional infrastructure. PostgreSQL already exists. Scale is sufficient.
Settled: yes.

## [2026-05-03] node-cron over external scheduler for scheduled scans
Reason: in-process access to all services. No additional infrastructure for solo project.
Risk: server restart loses in-flight jobs. Mitigation: ScheduledScanLog table in DB.
Settled: yes.

## [2026-05-03] Claude API for LLM remediation
Reason: project built with Anthropic tooling. Quality of code fixes is high.
Cost control: max 10 findings per scan sent to LLM, high/medium confidence only.
Settled: yes.

## [2026-05-03] Railway for deployment
Reason: managed PostgreSQL, Redis, and Node.js in one platform. Simple for solo project.
Three projects: local Docker Compose, redflagci-staging, redflagci-prod.
Settled: yes.

## [2026-05-03] Open source scan engine, proprietary backend
Reason: community contributes rules, engine improves. Intelligence layer is the moat.
Settled: yes.

## [2026-05-03] Services throw, controllers catch and call next(error)
Reason: consistent, predictable, centralized error handling. No scattered res.status(500).
Settled: yes.

## [2026-05-03] prisma migrate dev always, never prisma db push in production
Reason: migration files are the audit trail of schema changes. db push is destructive.
Settled: yes.

## [2026-05-03] TypeScript strict: true, no exceptions
Reason: type safety reduces surface area for runtime bugs. No implicit any.
Settled: yes.

## [2026-05-03] Reject Redis, Prometheus, Grafana as optional
Reason: Redis is required. Prometheus/Grafana is overkill for solo launch.
Settled: yes.

## [2026-05-03] Zero-comments codebase during build phase
Reason: Comments consume tokens on every context load during agentic sessions. A comment-heavy codebase means thousands of wasted tokens per session, increasing cost and reducing effective context window for actual logic. All comments, docstrings, block comments, and inline documentation are permanently stripped. Code is the documentation during build phase. Developer review happens at project completion.
Scope: All TypeScript (src/) and Python (scan-engine/) files.
Settled: yes. Non-negotiable.

## [2026-05-04] Git Push Workflow
Reason: Manual push to GitHub after every completed task to maintain a tight feedback loop and atomic history. We do not batch multiple tasks into one commit. After task completion, the agent stops, notifies the user, and returns the push commands for the user to execute manually.
Settled: yes.
