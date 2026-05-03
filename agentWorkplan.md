# RedFlag CI — Agent Workplan

This file is for the agentic AI building RedFlag CI. Read it in full at the start of every session before writing any code. It defines how to work, what to build, in what order, and how to avoid the most common failure modes.

---

## 0. Session Protocol

### Every Session Starts With

1. Read `vault/STATE.md` — know what is built and what is not
2. Read `vault/DECISIONS.md` — never re-debate settled decisions
3. Read `vault/SCHEMA.md` — know the current DB shape before touching Prisma
4. Read `vault/BUGS.md` — never build on top of known broken foundations
5. Read `vault/CONTRACTS.md` — your non-negotiable coding rules
6. Confirm the current stage from `STATE.md` before selecting a task

### Every Session Ends With

Ask to update the vault before closing:

- Check off completed items in `STATE.md`
- Log any new decisions in `DECISIONS.md`
- Update `SCHEMA.md` if `schema.prisma` changed
- Add new known issues to `BUGS.md`
- Add one line to `SESSION_LOG.md` summarising what was done

Never skip the end-of-session vault update. It is the only mechanism preventing context loss.

### After Every Single Response

Before sending any response, the agent must internally verify:

- [ ] Did I introduce any pattern banned by the Agent Contract (Section 7)?
- [ ] Did I use `any` type without a justification comment?
- [ ] Did I leave a floating Promise?
- [ ] Did I return `null` as an error signal from a service?
- [ ] Did I add a dependency without verifying it exists on npm/PyPI?
- [ ] Did I hardcode a value that belongs in `.env`?
- [ ] If a feature is now complete, is it checked off in `vault/STATE.md`?
- [ ] If a new decision was made, is it logged in `vault/DECISIONS.md`?
- [ ] If the schema changed, is `vault/SCHEMA.md` updated?

If any answer is yes — fix it before the response is final. Do not defer.

---

## 1. Core Working Principles

### Accuracy Over Speed

Do not move to the next task until the current one is complete, tested, and verified. A half-built feature that compiles is not done.

### One Thing at a Time

Complete one function, one service, one endpoint fully before starting the next. Do not scaffold multiple things simultaneously.

### No Assumptions

If requirements are ambiguous, stop and ask. Do not invent behaviour that was not specified. Invented behaviour is where bugs live.

### Follow the Build Order

The build order in Section 3 is the law. Do not jump ahead. Do not build Stage 5 features while Stage 2 bugs are unresolved.

### Tests Are Not Optional

A feature is not complete without tests. Write the test immediately after the implementation. Do not defer tests to "later."

### Vault Is the Single Source of Truth

If the vault says something different from what you remember from the conversation, the vault wins. Update it when decisions change.

### Conflict Resolution

When two sources say different things, apply this hierarchy:

1. `vault/BUGS.md` CRITICAL items — highest priority, always fix first
2. `vault/STATE.md` — current build state, what is and is not built
3. `vault/DECISIONS.md` — how things must be built
4. `agentWorkplan.md` — rules and process
5. `projectDocs.md` — intended design and specification

If `vault/STATE.md` says a feature is complete but the code does not exist, fix the code. If `projectDocs.md` describes a design but `vault/DECISIONS.md` has a later decision that overrides it, the DECISIONS.md entry wins. Never resolve conflicts by ignoring one source — surface the conflict and log the resolution in `vault/DECISIONS.md`.

### No Goldplating

Build exactly what the current stage specifies. Nothing more.

- No abstractions for a single use case — only abstract when a second real use case exists in the same stage
- No generic frameworks where a simple function works
- No premature optimization — make it correct first, optimize only when a measured problem exists
- No extra fields on DB models "just in case" — add them when they are needed
- No configuration options for things that only have one valid value right now

Gold-plated code looks impressive and ships broken. Simple code ships working.

---

## 2. The Four-Layer Defence Model

RedFlag CI is built using agentic AI. This creates a self-referential risk: the tool that detects AI-generated vulnerabilities is itself AI-generated. The following four layers mitigate this.

### Layer 1 — Agent Contract (Prevent)

The rules in Section 6 of this file define what the agent must never generate. These rules are applied to every line of code written. They prevent vulnerabilities from being introduced in the first place.

### Layer 2 — Expanded Scanners (Detect)

RedFlag CI scans its own codebase on every PR. The scan engine must be comprehensive enough to catch anything the agent contract missed. This is why the scanner coverage in `projectDocs.md` Section 7 is broad — it must cover the exact patterns an agentic AI tends to produce.

### Layer 3 — Dogfooding (Validate)

The RedFlag CI GitHub App is installed on the RedFlag CI repository itself from day one. Every PR is blocked if the risk score is 70 or above. Scan results are reviewed before merge. Weekly scheduled scans run on `main`. This proves the tool works and catches real issues in production.

### Layer 4 — Pre-commit + CI (Final Gate)

Before any commit reaches GitHub:

- Pre-commit hook runs a lightweight scan locally
- GitHub Actions runs `npm audit`, `pip-audit`, and TruffleHog on every push
- TypeScript strict mode compilation must pass
- All Jest tests must pass
- No merge if any gate fails

---

## 2.5 This Project Is Vibe-Coded — What That Means

RedFlag CI is built using Google Antigravity, an agentic IDE powered by Gemini 3 Pro. This means the tool that detects AI-generated vulnerabilities is itself AI-generated. This is a direct self-referential risk that must be consciously managed throughout the entire build.

Agentic AI produces code that:

- Compiles and appears correct but contains silent logic errors
- Uses `|| ''` fallbacks instead of throwing proper errors
- Adds `require()` calls inside function bodies
- Skips test coverage unless explicitly instructed
- Drifts from architectural decisions made in previous sessions
- Over-engineers early features and under-engineers later ones
- Adds dependencies without verifying they exist

The four-layer defence model in Section 3 exists entirely because of this risk. Every rule in the Agent Contract (Section 7) targets a specific pattern that agentic AI is statistically likely to produce. The vault system exists because the agent has no memory between sessions.

**This is not optional context. It is the reason this entire document exists.**

---

## 3. Build Order

Follow this exactly. Do not skip stages. Do not partially complete a stage and move on. Current progress is tracked in `vault/STATE.md` — read it to know where you are.

### Stage Advancement Criteria

A stage is complete only when ALL of the following are true:

- Every item in `vault/STATE.md` for that stage is checked
- All Jest and Supertest tests for that stage pass
- No CRITICAL items remain in `vault/BUGS.md` for that stage
- `vault/SCHEMA.md` reflects any migrations added in that stage
- `vault/SESSION_LOG.md` has an entry for the completion

Do not advance to the next stage until all five criteria are met.

### Stage 2 — Core Pipeline Bug Fixes (current)

Fix all CRITICAL bugs listed in `vault/BUGS.md` before writing any new code. Zero exceptions. A bug-free foundation is the only acceptable starting point for new features.

### Stage 3 — GitHub Integration Completion

Commit status, PR comment posting, auto-fix branch creation, installation event handlers. Every item requires a Supertest test verifying the GitHub API call is made with the correct payload.

### Stage 4 — New Analyzers

Each analyzer follows the exact interface: `analyze(files: List[DiffFile]) -> List[ScanFinding]`. Build one at a time. Write tests before moving to the next. Register each in `main.py` analyzers list — no other file needs to change. No analyzer makes network calls — network operations belong in Node.js services. All regex patterns compiled at module load time, never inside a loop.

### Stage 5 — Intelligence Layer

LLM layer is Node.js only — never Python. Calls Claude API after Python engine returns findings. Vulnerability chaining runs after all individual findings are collected. pgvector baseline system — implementation details in Section 7. Ignore rules API is part of this stage, not Stage 6.

### Stage 6 — Platform Features

Re-scan, scheduled scans, posture score, risk trending, AI impact report, security debt tracker. node-cron implementation details in Section 8. Claude API cost controls must be active before scheduled scans go live.

### Stage 7 — Community and Integration

Notifications, outbound webhooks, SARIF, badge, rule registry, audit log, pre-commit config generator. These are independent of each other and can be built in any order within the stage.

### Stage 8 — Hardening

Rate limiting, Redis OAuth state, Claude cost controls, full test coverage, production Docker, GitHub Actions CI, self-hosted pre-commit hook. No deployment to production until this stage is fully complete.

### Stage 9 — Frontend

Do not start until Stage 8 is complete and all tests pass. Frontend scope is defined separately — no instructions here until that discussion happens.

## 4. Technical Decisions

These decisions are final. Do not re-evaluate them. If a new decision is made, log it in `vault/DECISIONS.md` with the date and reason.

### Embedding Storage — pgvector

Use `pgvector` (PostgreSQL extension) for the semantic similarity scanner and codebase baseline embeddings.

**Why not Pinecone or Weaviate:**

- Both require external service accounts and API keys — more infrastructure to manage solo
- pgvector runs inside the existing PostgreSQL instance — zero additional services
- For the scale of this project (thousands of repos, not millions), pgvector is sufficient
- Keeps the stack simple: one database for everything

**Implementation:** Add `pgvector` extension to PostgreSQL. Add a `CodeEmbedding` model to Prisma schema with a `vector` column. Use `prisma-client-py` or raw SQL for vector similarity queries since Prisma does not natively support vector types yet.

### Scheduled Scans — node-cron (Internal)

Use `node-cron` running inside the Express application for scheduled full-repo scans.

**Why not an external scheduler (Railway cron, GitHub Actions schedule):**

- Railway cron requires a separate service or webhook endpoint
- GitHub Actions schedules are for CI tasks, not application-level operations
- `node-cron` runs in-process, has access to all services and DB directly
- Simpler for a solo project with no ops team

**Risk:** If the server restarts, in-flight cron jobs are lost. Mitigation: log scheduled scan start/completion to the DB. On startup, check for any scheduled scans that started but never completed and re-queue them.

### Claude API Rate Limiting

See full strategy in Section 9.

### Deployment — Railway

See full strategy in Section 10.

### Error Handling — Throw Always

Every service function throws on error. Every controller catches and calls `next(error)`. The global error handler in `errorHandler.middleware.ts` processes everything. No service returns `null` as an error signal. No controller does `res.status(500).json(...)` directly.

### Database Migrations — Always Named

Never use `prisma db push` except in local initial setup. All schema changes go through `prisma migrate dev --name descriptive-name`. Migration files are committed. Never squash migrations.

### TypeScript — Strict Mode Always

`tsconfig.json` has `strict: true`. No exceptions. No `// @ts-ignore` without an explanation comment. No top-level `any` types on external data — use Zod or explicit type guards at boundaries.

---

## 5. Avoiding Common Failure Modes

### Documentation Drift

`vault/STATE.md` is updated at the end of every session. If code exists that is not in `STATE.md`, add it. If `STATE.md` says something is built but it is not, fix the code. The vault is always correct.

### No Memory of Previous Decisions

`vault/DECISIONS.md` is the permanent record. Every non-obvious choice is logged there with date and reason. Before making any architectural decision, read `DECISIONS.md` first. If the decision was already made, follow it.

### Schema Drift

`vault/SCHEMA.md` is updated after every Prisma migration. It describes every model in plain English. The agent reads it before any DB-related work. If a migration is needed, check `SCHEMA.md` first to understand the current state before proposing changes.

### Skipped Test Coverage

A feature is not marked complete in `STATE.md` until its tests exist and pass. The test file is created in the same session as the implementation. No exceptions.

### Inconsistent Error Handling

Follow the pattern in Section 6. Services throw, controllers catch and call `next(error)`. Every new service and controller follows this exact pattern. Check existing files for reference before writing new ones.

### Over-Engineering Early

Build exactly what is specified for the current stage. No abstractions that are not needed yet. No generic frameworks for things that only have one use case. Add complexity when a second use case appears, not before.

### Under-Engineering Later

Later stages are not shortcuts. Stage 7 and 8 features get the same quality as Stage 2. Tests are required. Error handling is required. Vault updates are required.

---

## 6. Agent Contract — Non-Negotiable Coding Rules

These rules apply to every line of code written. No exceptions.

### Security Rules

- Never hardcode any value that belongs in `.env`
- Never disable authentication, SSL verification, or CORS restrictions, even temporarily
- Never use `*` wildcards in CORS origins, IAM policies, or permission scopes
- Never build SQL queries with string concatenation, f-strings, template literals, or `.format()`
- Never pass user input directly into LLM prompts without role separation
- Always use parameterized queries or ORM methods
- Always validate and sanitize all external input at the system boundary
- Always use `crypto.randomBytes()` for tokens and secrets — never `Math.random()`
- Never log request bodies, tokens, passwords, API keys, or user code snippets
- Never execute LLM-generated code — treat it as untrusted string output only
- Always validate LLM response schema before using the output
- Never send full database records to the LLM — send only the minimum required snippet

### Dependency Rules

- Only add packages that exist on npm or PyPI with verifiable download history
- Always use exact version pinning — no `^` or `~` or `*`
- Always commit lock files (`package-lock.json`, `requirements.txt` with pinned versions)
- Never add a dependency without confirming it has an active GitHub repository
- Prefer packages already in the dependency tree over adding new ones

### TypeScript Rules

- `strict: true` in `tsconfig.json` always
- No `any` type without an explicit justification comment on the same line
- No `require()` inside function bodies — all imports at the top of the file
- No floating Promises — always `await` or `.catch()`
- Always type external API response shapes explicitly — never trust `response.data` without a type

### Code Structure Rules

- Services throw errors — never return `null` as an error signal
- Controllers catch errors and call `next(error)` — never `res.status(500).json(...)` directly
- No business logic in controllers — extract to service functions
- No database queries in controllers — all DB access through service layer
- Every new route must go through auth middleware or be explicitly marked public with a comment

### Testing Rules

- Every service function has a Jest unit test
- Every API endpoint has a Supertest integration test
- Tests are written in the same session as the implementation
- No feature is marked complete in `STATE.md` without passing tests
- Test files live in `__tests__/` adjacent to the file being tested

### Python Engine Rules

- All logs go to `stderr` — never `print()` to `stdout` except the final JSON result
- Every analyzer follows the exact interface: `analyze(files: List[DiffFile]) -> List[ScanFinding]`
- Registering a new analyzer requires only one change: add it to the list in `main.py`
- No analyzer makes network calls — network operations belong in Node.js services
- All patterns are compiled at module load time — never compile regex inside a loop

---

## 7. Embedding Storage Implementation (pgvector)

### Setup

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Add to `schema.prisma`:

```prisma
model CodeEmbedding {
  id           String   @id @default(uuid())
  repositoryId String
  filePath     String
  commitSha    String
  embedding    Unsupported("vector(1536)")
  createdAt    DateTime @default(now())
  repository   Repository @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
}
```

### Usage Pattern

- On baseline scan: generate embeddings for each file's added lines, store in `CodeEmbedding`
- On PR scan: embed the diff snippets, query `CodeEmbedding` for cosine similarity matches above threshold
- Similarity threshold: 0.85 (tune based on false positive rate during dogfooding)
- Embedding model: use `text-embedding-3-small` from OpenAI (1536 dimensions, cheap) or a local model

### Cost Control

- Only embed files that changed — not the entire codebase on every scan
- Cache embeddings by `commitSha` — if the file did not change, reuse the existing embedding
- Batch embedding API calls — never one API call per line

---

## 8. Scheduled Scans Implementation (node-cron)

### Setup

```typescript
import cron from "node-cron";

// Run every Sunday at 2am UTC
cron.schedule("0 2 * * 0", async () => {
  await runScheduledScansForAllRepos();
});
```

### Reliability Pattern

Before starting a scheduled scan, write a `ScheduledScanLog` record with status `STARTED`. On completion, update to `COMPLETED`. On startup, query for any `STARTED` records older than 2 hours and re-queue them. This handles server restarts mid-scan.

### Concurrency Control

Process repositories in batches of 5. Use a semaphore or BullMQ batch jobs to prevent simultaneous full-repo scans from overwhelming the Python engine and Claude API.

---

## 9. Claude API Rate Limiting and Cost Control

### Per-Request Control

- Maximum tokens per LLM call: 1000 (sufficient for one finding's fix)
- Maximum findings sent to LLM per scan: 10 (highest severity first)
- Skip LLM for low-confidence findings — only call Claude for high and medium confidence
- Skip LLM for finding types with deterministic fixes (typosquats, known credentials)

### Per-User Rate Limiting

- Maximum LLM-powered scans per user per day: configurable via env var (default: 20)
- Track usage in Redis with a daily rolling counter per user
- When limit is reached: run scan without LLM layer, return deterministic results only, notify user

### Cost Monitoring

- Log every Claude API call with token count and estimated cost to the audit log
- Set a hard monthly spend cap via Anthropic API settings
- Alert (log at ERROR level) when daily spend exceeds threshold

### Fallback

If Claude API is unavailable or the rate limit is hit, the scan completes without LLM remediation. Deterministic fixes and static recommendations are still returned. The scan never fails because LLM is unavailable.

---

## 10. Deployment Strategy (Railway)

### Environment Separation

Three environments, three Railway projects:

**Development** — local Docker Compose only. No Railway. Uses `.env.local`.

**Staging** — Railway project `redflagci-staging`. Connected to `staging` branch. Auto-deploys on push. Uses staging GitHub App (separate App ID). Staging PostgreSQL and Redis instances. Used for testing before production.

**Production** — Railway project `redflagci-prod`. Connected to `main` branch. Manual deploy trigger (not auto-deploy). Production GitHub App. Production PostgreSQL and Redis.

### Railway Configuration

Each Railway project has:

- `backend` service: Node.js Express app
- `postgres` service: Railway-managed PostgreSQL
- `redis` service: Railway-managed Redis
- Environment variables set in Railway dashboard — never in code

### Environment Variables Per Environment

```
# All environments
DATABASE_URL
REDIS_HOST
REDIS_PORT
PORT
NODE_ENV                  # development | staging | production
JWT_SECRET
GITHUB_APP_ID
GITHUB_WEBHOOK_SECRET
GITHUB_APP_PRIVATE_KEY
GITHUB_OAUTH_CLIENT_ID
GITHUB_OAUTH_CLIENT_SECRET
GITHUB_OAUTH_CALLBACK_URL
ANTHROPIC_API_KEY
FRONTEND_URL

# Staging and Production only
OPENAI_API_KEY            # for embeddings
SENTRY_DSN                # error tracking
```

### Deployment Checklist (Production)

- [ ] All tests pass in CI
- [ ] Staging deployment verified and tested
- [ ] No high-severity findings in RedFlag CI self-scan
- [ ] `prisma migrate deploy` run against production DB
- [ ] Health check endpoint returns 200
- [ ] Manual deploy triggered in Railway dashboard

### Rollback

Railway keeps previous deployments. If production breaks, redeploy the previous build from the Railway dashboard. Database rollback: Railway PostgreSQL supports point-in-time recovery — keep automated backups enabled.

---

## 11. GitHub App Configuration

### Permissions Required

```
Repository permissions:
  - Contents: Read          (fetch diff and files)
  - Pull requests: Write    (post comments, open fix PRs)
  - Commit statuses: Write  (set pending/success/failure)
  - Metadata: Read          (repo info)

Account permissions:
  - Email addresses: Read   (user profile for OAuth)
```

### Webhook Events to Subscribe

```
- pull_request             (opened, synchronize, reopened)
- installation             (created, deleted)
- installation_repositories (added, removed)
```

### App Manifest (for marketplace listing)

```json
{
  "name": "RedFlag CI",
  "description": "Security scanner purpose-built for AI-generated code",
  "url": "https://redflagci.dev",
  "hook_attributes": {
    "url": "https://api.redflagci.dev/api/webhooks/github"
  },
  "redirect_url": "https://api.redflagci.dev/api/auth/github/callback",
  "public": true,
  "default_permissions": {
    "contents": "read",
    "pull_requests": "write",
    "statuses": "write",
    "metadata": "read"
  },
  "default_events": [
    "pull_request",
    "installation",
    "installation_repositories"
  ]
}
```

---

## 12. Open Source Strategy

### What Is Open Source

- `scan-engine/` — the entire Python detection engine
- `scan-engine/analyzers/` — all analyzer modules
- Community rule registry schema and submission format
- Pre-commit hook configuration templates

**Why:** Community can contribute new detection rules. The engine becomes self-improving. OSS credibility builds trust in the security tool.

### What Stays Proprietary

- Node.js backend (Express app, services, API)
- LLM remediation layer
- Codebase memory and baseline system
- False positive learning model
- Dashboard frontend
- Vulnerability chaining engine

**Why:** These are the differentiating platform features. The detection engine being open does not give away the intelligence layer.

### Contribution Model

Community contributes rules via the Public Rule Registry API. Submitted rules go into a review queue. Rules are reviewed for:

- Correctness — does the pattern actually detect what it claims
- Safety — does the rule have an acceptable false positive rate
- Malice — does the rule attempt to suppress real vulnerabilities or report false positives on competitor tools

Approved rules are merged into the open source engine and credited in the registry.

---

## 13. Community Rule Review System

### Submission Flow

1. Developer submits rule via `POST /api/rules` with pattern, description, example vulnerable code, example safe code
2. Rule stored in DB with status `PENDING`
3. Automated validation runs:
   - Pattern compiles without error
   - Pattern matches the example vulnerable code
   - Pattern does not match the example safe code
   - Pattern does not match common false positive strings
4. If automated checks pass, status moves to `UNDER_REVIEW`
5. Manual review by maintainer (you) via admin API
6. Approved rules move to `ACTIVE` and are included in scans
7. Rejected rules get a rejection reason stored and returned to submitter

### Anti-Malice Checks

- Rules that suppress findings on specific file paths are rejected
- Rules with patterns that match empty strings or trivially match everything are rejected
- Rules from accounts created less than 7 days ago go through extended review
- Rate limit on rule submissions: 5 per user per day

---
