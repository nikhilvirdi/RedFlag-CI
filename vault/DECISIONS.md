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

## [2026-05-05] Ghost Dependency Analyzer Scope
Reason: The scan engine operates on a diff-only basis to optimize for speed and context window. The Dead Code / Ghost Dependency analyzer only checks for dependency usage within the changed files (the current diff). 
Limitation: Dependencies that are added or modified in a PR but are only used in files *outside* the current diff will be flagged as ghost dependencies. This is an intentional trade-off to avoid scanning the entire repository on every commit.
Settled: yes.

## [2026-05-05] Input Validation Gap Detector Heuristics
Reason: Analyzing input-to-sink flow within a `DiffFile` (patch-only) is challenging without full-program data flow analysis.
Decision: Use pattern-based heuristics. A finding is triggered if:
1. A known sink (SQL, Command, Path, etc.) is found in an added line.
2. A known user-controlled source (req.body, sys.argv, etc.) is found in the same line or in a variable assignment within the same file's added lines.
3. No known sanitizer (parseInt, DOMPurify, Joi, etc.) is present in the same line as the sink.
Limitation: This may result in false positives if sanitization happens in lines not included in the diff.
Settled: yes.

## Stage 7: Notification and Webhook Architecture
Slack and Discord notifications use platform-native payload formats (Slack Block Kit, Discord embeds). Delivery is fire-and-forget with Promise.allSettled — a failed notification never blocks the scan pipeline. Outbound webhooks include HMAC-SHA256 signature via X-RedFlag-Signature header for payload verification. Secret is generated server-side via crypto.randomBytes and shown once at creation.
Settled: yes.

## Stage 7: Badge API — Public Endpoint
GET /api/badge/:repositoryId is unauthenticated by design so SVG badges can be embedded in GitHub READMEs. Cache-Control is set to no-cache to always reflect current posture. Trade-off: repository IDs are UUIDs so enumeration risk is minimal.
Settled: yes.

## Stage 7: Rules Registry — Static vs Dynamic
Analyzer rules are defined as a static array in rules.service.ts rather than stored in the database. This avoids an unnecessary migration path and keeps the registry fast. Community suggestions go through a separate RuleSuggestion table with a review workflow.
Settled: yes.

## Stage 7: Audit Log — Fire-and-Forget
recordAuditEvent wraps the Prisma create in a try-catch with logger.warn on failure. This ensures audit logging never throws and never interrupts the request flow. Trade-off: audit entries can silently fail, but this is acceptable for a non-critical observability layer.
Settled: yes.

## Stage 8: Rate Limiting — Tiered by Route Group
Global API routes: 100 req/15min. Auth routes: 20 req/15min (prevents brute force). Webhook ingest: 60 req/min (accommodates burst PR activity). Badge endpoint: 120 req/min (high traffic from README embeds). All backed by Redis store for horizontal scaling.
Settled: yes.

## Stage 8: OAuth State — Redis over In-Memory Map
In-memory Map does not survive process restarts and breaks in multi-instance deployments. Redis with TTL=600s (10 min) provides atomic consume-on-validate via GET+DEL pattern. Zero code change required in auth.service.ts — only auth.controller.ts updated.
Settled: yes.

## Stage 8: Claude Circuit Breaker Pattern
5 consecutive API failures or a 429 response trips the circuit breaker for 300 seconds. During open circuit, all remediation calls are skipped gracefully (findings returned without remediation). Hourly limits: 60 calls, 500k tokens. Token usage tracked via Redis INCR with TTL-based window expiry.
Settled: yes.

## Stage 8: API Quota Enforcement — Monthly Rolling Window
Per-user monthly quotas tracked in ApiQuota table with upsert on each request. Default limits: 1000 API requests/month, 100 scans/month. Quota middleware runs after auth but before route handlers. Headers X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset set on every response. Scan quota checked separately in scan pipeline.
Settled: yes.

## Stage 8: Multi-Stage Docker Build
Four stages: base (node:20-alpine + python3), deps (npm ci --omit=dev), build (full npm ci + tsc), production (non-root user, healthcheck, minimal footprint). Prisma client generated at build time, .prisma directory copied to production stage.
Settled: yes.
