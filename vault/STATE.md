# RedFlag CI — Build State

Last updated: 2026-05-04 (end of session 4)
Current stage: Stage 4 — New Analyzers
Next task: Stage 4 Task 7 — Environment boundary analyzer

## Stage 1 — Foundation ✅
- [x] Express app structure (app.ts, index.ts)
- [x] Environment validation (env.ts)
- [x] Database connection singleton (db.ts)
- [x] Redis connection (redis.ts)
- [x] GitHub OAuth flow (redirect, callback, JWT)
- [x] JWT authenticate middleware
- [x] GitHub signature verification middleware
- [x] Error handler middleware
- [x] BullMQ scan queue
- [x] BullMQ scan worker
- [x] Webhook controller (PR event filtering)
- [x] Auth controller and service
- [x] Dashboard controller and service (5 endpoints)
- [x] Prisma schema (User, Repository, ScanResult, RiskScore, Finding, Remediation)
- [x] Initial migration
- [x] Winston logger
- [x] Graceful shutdown

## Stage 2 — Core Pipeline ✅
### Bug Fixes Required Before Proceeding
- [x] Fix python → python3 in scan.service.ts spawn call
- [x] Add REDIS_HOST, REDIS_PORT to env.ts validation
- [x] Add installation.created webhook handler (create Repository in DB)
- [x] Fix repository.connect || '' fallback — throw proper error
- [x] Move require() calls in auth.controller.ts to top-level imports

### Scan Engine (Complete)
- [x] diff_parser.py
- [x] models.py
- [x] scoring.py
- [x] main.py
- [x] credential_analyzer.py (3-layer: patterns, var names, entropy)
- [x] sql_injection_analyzer.py (5 patterns)
- [x] dependency_analyzer.py (typosquat DB + heuristics)
- [x] prompt_injection_analyzer.py (LLM context detection)
- [x] Node.js → Python bridge (child_process.spawn)

## Stage 3 — GitHub Integration Completion ✅
- [x] Commit status updates
- [x] PR comment posting
- [x] Auto-fix branch and PR creation
- [x] installation.repositories_added handler
- [x] installation.deleted handler

## Stage 4 — New Analyzers (In Progress)
- [x] Hallucinated package detector (live npm + PyPI API verification)
- [x] AI code fingerprinter
- [x] Semgrep SAST subprocess
- [x] Checkov IaC subprocess
- [x] License risk detector
- [x] TruffleHog git history subprocess
- [ ] Environment boundary analyzer
- [ ] Dead code and ghost dependency detector
- [ ] Auth/authz pattern analyzer
- [ ] Cryptography weakness detector
- [ ] Input validation gap detector
- [ ] Node.js/Python dangerous pattern detector
- [ ] Async/concurrency issue detector

## Stage 5 — Intelligence Layer
- [ ] LLM remediation layer (Claude API)
- [ ] Vulnerability chaining engine
- [ ] Codebase memory and baseline (pgvector)
- [ ] Semantic similarity scanner
- [ ] False positive learning model
- [ ] Ignore rules API

## Stage 6 — Platform Features
- [ ] Re-scan on demand API
- [ ] Scheduled full-repo scans (node-cron)
- [ ] Security posture score
- [ ] Risk trending API
- [ ] AI usage impact report API
- [ ] Security debt tracker

## Stage 7 — Community and Integration
- [ ] Slack/Discord notifications
- [ ] Outbound webhook API
- [ ] SARIF export
- [ ] RedFlag badge API
- [ ] Public rule registry API
- [ ] Community rule review queue
- [ ] Pre-commit hook config generator
- [ ] Audit log service and API

## Stage 8 — Hardening
- [ ] Rate limiting (express-rate-limit + Redis)
- [ ] OAuth state → Redis
- [ ] Claude API rate limiting and cost controls
- [ ] API quota enforcement
- [ ] Full Jest coverage
- [ ] Full Supertest coverage
- [ ] Production Docker config
- [ ] GitHub Actions CI pipeline
- [ ] Pre-commit hook for RedFlag CI repo itself

## Stage 9 — Frontend
- [ ] Next.js dashboard
- [ ] Auth flow
- [ ] Repository views
- [ ] Scan history and report view
- [ ] Posture score and trend charts
- [ ] Notification config UI
