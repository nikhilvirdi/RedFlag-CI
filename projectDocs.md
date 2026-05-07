# RedFlag CI — Project Documentation

---

## 1. Project Overview

RedFlag CI is an automated security intelligence system purpose-built for AI-assisted development. It integrates directly into the GitHub pull request workflow, analyzes every code change for security vulnerabilities, and delivers actionable findings before code is merged.

Unlike general-purpose SAST tools, RedFlag CI is specifically designed to detect vulnerability patterns that emerge from AI code generation — hallucinated packages, insecure defaults, disabled authentication scaffolding, and prompt injection risks. It combines static analysis, semantic code understanding, LLM-powered remediation, and a learning engine that improves over time.

The system operates as a GitHub App, requires zero configuration from developers, and exposes all results through a REST API consumed by a web dashboard.

---

## 2. Problem Statement

AI coding assistants (Copilot, ChatGPT, Cursor, Antigravity) have accelerated software development significantly. However, they introduce a new class of security risk that existing tools are not equipped to handle.

AI-generated code frequently contains:

- Hardcoded credentials copied from training data patterns
- Packages that do not exist on npm or PyPI (hallucinations)
- Disabled authentication with `// TODO: add auth later` comments
- Wildcard CORS, broad IAM permissions, and insecure defaults
- SQL queries built with string interpolation
- User input passed directly into LLM prompts
- Debug scaffolding left in production code paths

Tools like Snyk, SonarQube, and Semgrep detect general vulnerabilities but are not built to understand AI-generated code patterns, correlate findings into exploit chains, or learn from a repository's specific false positive history.

This gap means developers shipping AI-generated code are doing so without a security layer that understands what they are actually producing.

---

## 3. Objective

Build a production-grade, community-facing security analysis system that:

- Triggers automatically on every pull request via GitHub App
- Detects vulnerabilities specific to AI-generated code alongside standard security issues
- Correlates findings into chained exploit paths, not just isolated issues
- Generates LLM-powered contextual fixes and pushes auto-fix branches
- Learns from each repository's history to reduce false positives over time
- Tracks security posture and risk trends across repositories
- Exposes results through a structured REST API and web dashboard
- Provides community infrastructure through a public rule registry and SARIF export

---

## 4. Target Users

**Primary:** Individual developers and small teams using AI coding tools who ship fast and lack dedicated security review.

**Secondary:** Open-source maintainers who want automated security coverage on contributor PRs.

**Tertiary:** Engineering teams that need audit logs, SARIF exports, and security posture tracking for compliance or reporting purposes.

---

## 5. Key Value Proposition

- First security scanner purpose-built for AI-generated code patterns
- Vulnerability chaining — correlates multiple findings into real exploit paths
- LLM-powered remediation that understands code context, not just pattern templates
- Auto-fix PR creation — not just comments, actual committed fixes
- Codebase memory — learns your repo, reduces noise over time
- Community-driven rule registry — open and extensible
- Zero configuration — install GitHub App, scanning begins immediately

---

## 6. System Architecture

### Pipeline Flow

```
PR Opened / Updated
  → GitHub App Webhook received
  → HMAC-SHA256 signature verified
  → 200 OK returned immediately (async handoff)
  → Job enqueued in BullMQ (Redis-backed)
  → Commit status set to [pending]
  → PR diff fetched from GitHub API
  → Diff parsed into structured added-lines
  → Parallel analyzer pipeline executed:
      ├── Credential & Secret Detection
      ├── SQL Injection Detection
      ├── Prompt Injection Detection
      ├── Hallucinated Package Detection (live npm/PyPI check)
      ├── AI Code Fingerprinting
      ├── SAST via Semgrep (XSS, SSRF, path traversal, command injection)
      ├── IaC Security Scanner (Dockerfile, docker-compose, k8s)
      ├── Dependency & Supply Chain Analysis
      ├── License Risk Detection
      ├── Secret Git History Scanner
      ├── Semantic Similarity Scanner
      ├── Dead Code & Ghost Dependency Detector
      └── Environment Boundary Analyzer
  → Findings aggregated
  → Vulnerability Chaining Engine runs (cross-finding correlation)
  → Risk Score computed (weighted severity × confidence)
  → Security Posture Score updated
  → LLM Remediation Layer called (Claude API) for each finding
  → Auto-Fix PR created (if fixable findings exist)
  → Markdown report generated
  → PR comment posted
  → Commit status set to [success] or [failure]
  → Results persisted to PostgreSQL
  → Codebase Memory & Baseline updated
  → Outbound webhook fired (if configured)
  → Slack/Discord notification sent (if configured)
  → Audit log entry written
```

### Component Responsibilities

**GitHub App** handles installation, webhook delivery, and permission scoping. One-click install from the GitHub Marketplace.

**Express Backend** is the orchestrator. It receives webhooks, manages the job queue, exposes the REST API, handles auth, and coordinates all services.

**BullMQ Queue (Redis)** decouples webhook receipt from scan execution. Provides retry with exponential backoff, deduplication by job ID, and concurrency control.

**Python Scan Engine** is the core detection layer. Spawned as a child process by Node.js via `python3`. Communicates via stdin (diff JSON) and stdout (findings JSON). Stateless and replaceable.

**LLM Remediation Layer** calls the Claude API with each finding and its code context. Returns plain-English explanations and context-aware fixes. Runs in Node.js after the Python engine returns results.

**Vulnerability Chaining Engine** runs in Node.js after all individual findings are collected. Correlates findings from a single scan into multi-step exploit chains with elevated severity.

**Codebase Memory & Baseline** stores pgvector embeddings of the default branch per repository. PR scans diff against the baseline so only new issues introduced by the PR are surfaced.

**PostgreSQL + Prisma** stores all persistent state: users, repositories, scan results, findings, remediations, baselines, audit logs, and rule registry entries.

**GitHub Service** handles installation token generation, diff fetching, PR comment posting, commit status updates, and auto-fix branch creation.

---

## 7. Security Detection Capabilities

### 7.1 Credential & Secret Detection

Three-layer detection approach:

**Layer 1 — Known Format Patterns:** Regex matching for AWS keys, GitHub tokens, Stripe keys, private PEM keys, JWTs, and database connection strings with embedded credentials. High confidence — the format itself is proof.

**Layer 2 — Variable Assignment Patterns:** Detects security-sensitive variable names (`password`, `secret`, `token`, `api_key`) assigned string literals. Medium confidence.

**Layer 3 — Shannon Entropy Analysis:** Calculates information-theoretic entropy on quoted strings. Strings with entropy above 4.5 and length above 20 characters are flagged as probable secrets. Catches secrets that don't match known formats.

### 7.2 SQL Injection Detection

Detects unsafe database query construction across Python and JavaScript/TypeScript:

- String concatenation in SQL queries (`"SELECT ... " + userId`)
- Python f-string interpolation (`f"SELECT ... WHERE id = {user_id}"`)
- `.format()` method on SQL strings
- JavaScript template literals with SQL keywords
- Python `%` string formatting on SQL strings

Performance-gated: lines without SQL keywords are skipped before regex evaluation.

### 7.3 Prompt Injection Detection

Detects user-controlled input passed directly into LLM prompts:

- f-string interpolation in prompt/message/system content variables
- JavaScript template literals in prompt construction
- String concatenation building prompt strings
- `.format()` used on prompt templates

Two-phase: first detects if the file contains LLM API calls (OpenAI, Anthropic, LangChain, Gemini), then boosts confidence on unsafe interpolation findings within those files.

### 7.4 Hallucinated Package Detection

Checks every imported package against live npm and PyPI registry APIs to verify existence. Flags packages that:

- Return 404 from the registry
- Were created less than 7 days ago with zero downloads
- Have no associated GitHub repository

This is a novel detection capability not present in any existing scanner. AI tools frequently invent package names that do not exist on registries.

### 7.5 AI Code Fingerprinting & Insecure Default Detection

Detects patterns statistically associated with AI-generated code:

- Disabled or missing authentication (`// TODO: add auth`, `authenticate = False`)
- Wildcard CORS (`origin: '*'`, `Access-Control-Allow-Origin: *`)
- Broad permissions (`*` in IAM policies, wildcard DB access)
- Test credentials left in production paths (`admin/admin`, `test@test.com`, `password123`)
- Debug flags in production context (`debug=True`, `verify=False`, `ssl=False`)
- Over-permissioned file operations (`chmod 777`)
- Disabled TLS verification

### 7.6 SAST via Semgrep

Invoked as a CLI subprocess. Detects:

- Cross-site scripting (XSS) — reflected and stored patterns
- Server-side request forgery (SSRF)
- Path traversal (`../` in file operations)
- Command injection (unsanitized input in shell commands)
- Insecure deserialization
- Open redirect vulnerabilities

Uses Semgrep's community rule registry plus custom RedFlag rules.

### 7.7 IaC Security Scanner (Checkov)

Invoked as a CLI subprocess. Scans:

- Dockerfiles: running as root, exposed sensitive ports, no HEALTHCHECK, ADD instead of COPY
- docker-compose: privileged mode, host network binding, hardcoded secrets in environment
- Kubernetes manifests: missing resource limits, privileged containers, hostPath mounts

### 7.8 Dependency & Supply Chain Analysis

- Checks imported packages against a curated typosquat database (known malicious variants of popular packages)
- Applies heuristic rules: packages with 4+ digit numeric suffixes, social engineering keywords, names exceeding 40 characters
- Supports JS/TS imports, Python imports, package.json entries, and requirements.txt

### 7.9 License Risk Detection

Parses dependency declarations and checks each package's license against the SPDX license database. Flags:

- GPL/AGPL licenses in commercial repositories (copyleft contamination risk)
- Unknown or unlicensed packages
- License conflicts between declared dependencies

### 7.10 Secret Git History Scanner

Scans the git history of the repository for secrets that were committed and later deleted. Deleted secrets remain in git history and are exploitable. Uses TruffleHog as a CLI subprocess against the full commit log.

### 7.11 Environment Boundary Analyzer

Detects development or debug artifacts that have leaked into production code paths:

- `console.log` statements containing sensitive variable names
- Hardcoded localhost URLs and development endpoints
- Debug-only code outside conditional guards
- Commented-out authentication checks

### 7.12 Dead Code & Ghost Dependency Detector

- Identifies imported packages declared in `package.json` or `requirements.txt` but never referenced in the codebase
- Flags unused import statements in added lines
- Reduces unnecessary attack surface and dependency bloat common in AI-generated code

### 7.13 Auth & Authorization Pattern Analyzer

Detects missing or broken authentication and authorization patterns:

- Route definitions missing auth middleware
- JWT verified without expiry check (`jwt.decode()` instead of `jwt.verify()`)
- Hardcoded role bypasses (`if user === 'admin'`)
- Missing resource ownership checks on endpoints (IDOR risk)
- Auth middleware applied inconsistently across route groups

### 7.14 Cryptography Weakness Detector

Flags cryptographically unsafe usage:

- Weak hashing algorithms for passwords (MD5, SHA1)
- Static or hardcoded IV in AES encryption
- `Math.random()` used for security-sensitive values (tokens, salts, nonces)
- Insufficient key lengths (RSA < 2048 bits, AES < 256 bits)
- Deprecated cipher modes (ECB mode usage)

### 7.15 Input Validation Gap Detector

Detects missing or incomplete input validation at system boundaries:

- No length limits on user-facing string fields
- Regex patterns without timeout guards (ReDoS vulnerability)
- Unvalidated redirects and forwards
- File upload handlers missing MIME type or file size validation
- External API responses used without schema validation

### 7.16 Node.js / Python Dangerous Pattern Detector

**Node.js patterns:**

- `child_process.exec()` with unsanitized variable input
- `eval()` or `new Function()` with dynamic content
- Path traversal in file operations (`path.join` without normalization)
- Prototype pollution patterns (`__proto__`, `constructor.prototype`)
- `JSON.parse()` without try/catch on external input

**Python patterns:**

- `pickle.loads()` on untrusted input
- `subprocess.shell=True` with variable input
- `yaml.load()` without `Loader=yaml.SafeLoader`
- `os.system()` with unsanitized input
- `exec()` or `eval()` on external data

### 7.17 Async & Concurrency Issue Detector

Detects unsafe asynchronous and concurrent code patterns:

- Unhandled Promise rejections (floating Promises without `.catch()`)
- Missing error handling in async BullMQ worker callbacks
- Race conditions in concurrent database writes executed outside transactions
- `async` functions called without `await` in critical paths

### 7.18 Context-Aware Vulnerability Chaining

Runs after all individual analyzers complete. Analyzes the full finding set from a scan and identifies combinations that form multi-step exploitable attack chains. Examples:

- `wildcard CORS` + `missing auth middleware` + `SQL injection` = full unauthenticated data breach path
- `hardcoded AWS key` + `S3 bucket public access` = credential and exposure chain
- `SSRF` + `internal metadata endpoint access` = cloud credential theft chain

Each chain is reported as a separate finding with elevated severity and a chain-specific description. No existing scanner performs cross-finding correlation of this type.

### 7.19 Semantic Similarity Scanner

Embeds code snippets from the diff using a code embedding model and compares them against a pgvector database of known-vulnerable code patterns. Catches obfuscated, reformatted, or AI-paraphrased versions of known vulnerabilities that regex patterns would miss. Similarity threshold: 0.85 cosine distance. Only runs if a baseline embedding index exists for the repository.

---

## 8. Risk Evaluation & Scoring

### Weighted Scoring Model

Each finding contributes to the Security Risk Score using:

```
finding_contribution = severity_weight × confidence_multiplier
```

Severity weights: `critical = 25`, `high = 15`, `medium = 8`, `low = 3`

Confidence multipliers: `high = 1.0`, `medium = 0.7`, `low = 0.4`

Raw score is the sum of all contributions, normalized to 0–100.

### Classification Thresholds

| Score  | Classification |
| ------ | -------------- |
| 80–100 | CRITICAL       |
| 60–79  | HIGH           |
| 30–59  | MEDIUM         |
| 1–29   | LOW            |
| 0      | CLEAN          |

### Security Posture Score

A separate long-term score (0–100) calculated per repository from:

- Average risk score across the last 30 scans
- Trend direction (improving or worsening)
- Unresolved finding count
- Fix rate over time

This is distinct from per-PR risk score. It represents the overall health of the repository over time.

### Risk Trending

Every scan result is timestamped and stored. The system computes the risk score trajectory per repository — whether the codebase is improving or degrading in security posture over time. Trend data is exposed via API for dashboard visualization.

### AI Usage Impact Report

Tracks correlation between AI-generated code patterns (detected by the fingerprinter) and vulnerability rates. Produces per-repository metrics such as: what percentage of findings appear in AI-fingerprinted code. Exposed as a dedicated API endpoint.

---

## 9. Remediation System

### LLM-Powered Contextual Remediation

For each finding, the system calls the Claude API with:

- The finding type, severity, and description
- The original vulnerable code snippet
- The file context (language, framework hints)

Claude returns:

- A plain-English explanation of why the code is vulnerable
- A corrected code snippet specific to the developer's actual code (not a generic template)
- The reasoning behind the fix

This replaces the static recommendation strings that existing tools use.

### Auto-Fix PR Creation

After scan completion, if any findings have high-confidence automatic fixes available (from either the deterministic remediation layer or the LLM layer), the system:

1. Creates a new branch (`redflag/fix-pr-{number}`)
2. Applies the corrected code to the relevant files
3. Commits with a structured message listing each fix
4. Opens a pull request against the original PR's base branch with a summary of all applied fixes

### Deterministic Remediation

For well-defined vulnerability patterns (typosquat replacement, known credential removal, parameterized query substitution), the scan engine generates corrected code without LLM involvement. Faster and cheaper for clear-cut cases.

### Ignore Rules

Developers can mark any finding as a false positive via API. The ignore rule is stored per repository with:

- Finding type
- File path (optional — for file-specific suppression)
- Reason (optional)

Ignored rules are applied to all future scans of that repository before results are returned.

### False Positive Learning

When a finding type is repeatedly ignored in a specific repository, the system builds a suppression model for that repo. After sufficient signal, high-confidence false positives are automatically suppressed without developer action. The suppression model is stored per repository and improves with each scan cycle.

### Codebase Memory & Baseline

On first scan, the system builds a security baseline for the entire default branch. Subsequent PR scans compare findings against this baseline and surface only NEW issues introduced by the PR. This dramatically reduces noise — developers only see what their code change broke, not pre-existing issues.

Baseline is stored as a vector embedding index per repository and updated after each merged PR.

---

## 10. GitHub Integration

### GitHub App

Distributed as a marketplace-installable GitHub App. One-click installation grants the App access to selected repositories. No manual webhook configuration required.

On installation, the system:

1. Receives the `installation.created` webhook event
2. Fetches the list of repositories granted access
3. Creates Repository records in the database for each

### Webhook Pipeline

GitHub sends signed webhook payloads for every PR event. The backend:

1. Verifies the HMAC-SHA256 signature using `x-hub-signature-256` header with timing-safe comparison
2. Returns HTTP 200 immediately to prevent GitHub from marking the delivery as failed
3. Enqueues the scan job in BullMQ with a deterministic job ID to prevent duplicate scans

### PR Comment

Scan results are posted as a structured markdown comment on the PR. The comment includes the risk score, classification, finding list with severity and location, vulnerable code snippets, and remediation outputs.

### Commit Status

The system sets three commit status states:

- `pending` — immediately when the scan starts (shows yellow dot on PR)
- `success` — when risk score is below the threshold
- `failure` — when risk score is at or above the threshold (can block merge in protected branches)

### Auto-Fix Branch

When fixes are available, the system pushes a new branch and opens a PR against the base branch. This is separate from the commit status — developers can merge the fix PR independently.

---

## 11. API Design

All endpoints are REST. Protected routes require `Authorization: Bearer <JWT>` header.

### Auth Endpoints

| Method | Path                        | Description                        |
| ------ | --------------------------- | ---------------------------------- |
| GET    | `/api/auth/github/redirect` | Initiates GitHub OAuth flow        |
| GET    | `/api/auth/github/callback` | Handles OAuth callback, issues JWT |
| GET    | `/api/auth/me`              | Returns authenticated user profile |

### Webhook Endpoint

| Method | Path                   | Description                            |
| ------ | ---------------------- | -------------------------------------- |
| POST   | `/api/webhooks/github` | Receives all GitHub App webhook events |

### Dashboard Endpoints

| Method | Path                                        | Description                            |
| ------ | ------------------------------------------- | -------------------------------------- |
| GET    | `/api/dashboard/stats`                      | Aggregate stats for authenticated user |
| GET    | `/api/dashboard/repositories`               | All repositories for user              |
| GET    | `/api/dashboard/repositories/:id`           | Single repository detail               |
| GET    | `/api/dashboard/repositories/:id/scans`     | Paginated scan history                 |
| GET    | `/api/dashboard/scans/:scanId`              | Full scan detail with all findings     |
| POST   | `/api/dashboard/repositories/:id/rescan`    | Trigger on-demand scan                 |
| GET    | `/api/dashboard/repositories/:id/posture`   | Security posture score + trend         |
| GET    | `/api/dashboard/repositories/:id/ai-impact` | AI usage impact report                 |

### Ignore Rules Endpoints

| Method | Path                                         | Description        |
| ------ | -------------------------------------------- | ------------------ |
| POST   | `/api/repositories/:id/ignore-rules`         | Create ignore rule |
| GET    | `/api/repositories/:id/ignore-rules`         | List ignore rules  |
| DELETE | `/api/repositories/:id/ignore-rules/:ruleId` | Remove ignore rule |

### Notification Endpoints

| Method | Path                                  | Description                     |
| ------ | ------------------------------------- | ------------------------------- |
| POST   | `/api/repositories/:id/notifications` | Configure Slack/Discord webhook |
| GET    | `/api/repositories/:id/notifications` | Get notification config         |
| DELETE | `/api/repositories/:id/notifications` | Remove notification config      |

### Platform Endpoints

| Method | Path                             | Description                       |
| ------ | -------------------------------- | --------------------------------- |
| GET    | `/api/rules`                     | List public rule registry         |
| POST   | `/api/rules`                     | Submit community rule             |
| GET    | `/api/scans/:scanId/sarif`       | Export scan as SARIF file         |
| GET    | `/api/badge/:repoId`             | SVG badge with live posture score |
| GET    | `/api/webhooks/outbound/:repoId` | Get outbound webhook config       |
| POST   | `/api/webhooks/outbound/:repoId` | Set outbound webhook URL          |
| GET    | `/api/audit-log`                 | Retrieve audit log for user       |

### Pre-commit Hook Endpoint

| Method | Path                                     | Description                             |
| ------ | ---------------------------------------- | --------------------------------------- |
| GET    | `/api/repositories/:id/precommit-config` | Returns pre-commit YAML config for repo |

---

## 12. Scheduled Operations

### Full-Repo Scheduled Scans

A cron job runs weekly against the default branch of every registered repository. This catches vulnerabilities that existed before RedFlag CI was installed and were not caught by PR-level scans. Results are stored as baseline scans and visible in the dashboard scan history.

### Baseline Refresh

After each merged PR, the codebase baseline is updated to reflect the new state of the default branch. This keeps the baseline current so future PR scans accurately identify only new issues.

### OAuth State Cleanup

Expired OAuth state tokens are purged from the in-memory state store on a scheduled interval to prevent memory growth.

---

## 13. Platform & Community Features

### Public Rule Registry

A publicly accessible API listing all community-contributed detection rules. Each rule contains:

- Rule ID and name
- Vulnerability category
- Detection pattern (regex or Semgrep rule)
- Example vulnerable code
- Example safe code
- Contributor attribution

Developers can submit rules via API. Accepted rules are incorporated into the scan engine and credited in the registry. This makes RedFlag CI self-improving and community-driven.

### RedFlag Badge

A real-time SVG badge served from the API displaying the repository's current security posture score. Developers embed it in their README:

```
[![RedFlag Score](https://redflagci.dev/api/badge/:repoId)](https://redflagci.dev)
```

Every repository using RedFlag CI becomes a distribution channel.

### SARIF Export

Any scan result can be exported as a `.sarif` file (Static Analysis Results Interchange Format). SARIF is the industry standard for security tool output, compatible with GitHub Code Scanning, VS Code, and enterprise SAST platforms. This makes RedFlag CI results portable and auditable outside the system.

### Audit Log

Every system action is written to an immutable audit log:

- Scan triggered (by whom, when, which repo)
- Findings detected
- Ignore rules created or deleted
- Auto-fix PRs created
- Notification configurations changed

Exposed via API. Provides traceability for compliance and security review purposes.

### Outbound Webhook API

Users configure a URL to receive scan result payloads via HTTP POST after each scan completes. This enables custom integrations (internal dashboards, alerting systems, Jira ticket creation) without waiting for native integrations to be built.

### Slack & Discord Notifications

Per-repository notification configuration. After each scan, the system sends a structured message to the configured Slack or Discord webhook URL containing the risk score, classification, and a link to the full report.

### API Rate Limiting & Quotas

Per-user rate limiting on all API endpoints using a sliding window algorithm. Enforced at the middleware level with Redis as the counter store. Provides foundation for usage-based monetization without requiring a full billing system immediately.

---

## 14. Security & Reliability

### Webhook Security

HMAC-SHA256 signature verification on all incoming webhook payloads. Uses `crypto.timingSafeEqual()` for constant-time comparison to prevent timing attacks. Requests without a valid signature are rejected with HTTP 401 before reaching any business logic.

### Authentication

GitHub OAuth 2.0 for user login. JWT sessions signed with HMAC-SHA256. Tokens carry only the user's internal database ID. 7-day expiry. OAuth state parameter prevents CSRF attacks. State stored in-memory with TTL.

### Authorization

Resource-level ownership checks on all repository and scan endpoints (IDOR protection). The JWT middleware confirms authentication; service-layer checks confirm ownership.

### Queue Reliability

BullMQ with Redis backend. Jobs have deterministic IDs (repo + PR number + commit SHA) preventing duplicate scans. Failed jobs retry up to 3 times with exponential backoff. Failed jobs retained for 7 days for post-mortem. Completed jobs retained for 24 hours.

### Graceful Shutdown

On SIGINT, the server stops accepting new connections, waits for the BullMQ worker to finish current jobs, closes the database connection, and exits cleanly.

### Error Handling

Centralized error handler middleware. Controllers never leak stack traces. Production errors return generic messages; development errors include details. All errors logged via Winston with structured context.

### Rate Limiting

`express-rate-limit` on all public-facing endpoints. Redis-backed for accuracy across multiple instances.

---

## 15. Tech Stack

### Backend

| Component   | Technology             | Purpose                                 |
| ----------- | ---------------------- | --------------------------------------- |
| Runtime     | Node.js                | Core application execution              |
| Framework   | Express.js             | HTTP routing and middleware             |
| Language    | TypeScript (strict)    | Type safety throughout                  |
| Validation  | Zod                    | Runtime schema validation at boundaries |
| Job Queue   | BullMQ                 | Async scan job management               |
| Queue Store | Redis / ioredis        | BullMQ backend + rate limit counters    |
| Scheduler   | node-cron              | Scheduled full-repo scans               |
| Auth        | GitHub OAuth 2.0 + JWT | User authentication                     |
| HTTP Client | Axios                  | GitHub API calls + LLM API calls        |
| Logging     | Winston + Morgan       | Structured logging                      |
| Testing     | Jest + Supertest       | Unit and API tests                      |

### Scan Engine

| Component        | Technology              | Purpose                                      |
| ---------------- | ----------------------- | -------------------------------------------- |
| Engine Language  | Python                  | Core detection logic                         |
| SAST             | Semgrep (CLI)           | XSS, SSRF, path traversal, command injection |
| Secret Detection | TruffleHog (CLI)        | Git history secret scanning                  |
| IaC Scanning     | Checkov (CLI)           | Dockerfile, k8s, compose scanning            |
| Code Parsing     | Python AST + Regex      | Pattern and structural analysis              |
| Embeddings       | Code embedding model    | Semantic similarity scanner (pgvector)       |
| Registry API     | npm Registry + PyPI API | Hallucinated package detection               |
| License DB       | SPDX API                | License risk detection                       |
| Analyzers        | 19 modules              | See Section 7 for full capability list       |
| Vector Store     | pgvector (PostgreSQL)   | Baseline embeddings + similarity search      |

### LLM Layer

| Component    | Technology             | Purpose                              |
| ------------ | ---------------------- | ------------------------------------ |
| LLM Provider | Claude API (Anthropic) | Contextual fix generation            |
| Integration  | REST via Axios         | API calls from Node.js service layer |

### Data Layer

| Component | Technology | Purpose                       |
| --------- | ---------- | ----------------------------- |
| Database  | PostgreSQL | All persistent storage        |
| ORM       | Prisma     | Schema management and queries |

### Integration

| Component  | Technology      | Purpose                                |
| ---------- | --------------- | -------------------------------------- |
| GitHub App | @octokit/app    | App-level auth and installation tokens |
| GitHub API | @octokit/rest   | Diff fetch, PR comments, commit status |
| Webhooks   | GitHub Webhooks | PR event triggers                      |

### Frontend

| Component     | Technology           | Purpose                       |
| ------------- | -------------------- | ----------------------------- |
| Framework     | Next.js + TypeScript | Dashboard web application     |
| Styling       | Tailwind CSS         | UI styling                    |
| State         | Zustand              | Global state management       |
| Data Fetching | TanStack Query       | API calls and caching         |
| Forms         | React Hook Form      | Input handling and validation |

### DevOps

| Component        | Technology              | Purpose                            |
| ---------------- | ----------------------- | ---------------------------------- |
| Containerization | Docker + Docker Compose | Local and production environment   |
| Deployment       | Railway                 | Cloud deployment                   |
| CI/CD            | GitHub Actions          | Build, test, and deploy automation |
| Code Quality     | ESLint + Prettier       | Consistent code standards          |

---

## 16. Database Schema Overview

### Core Entities

**User** — Authenticated developer. Identified by GitHub numeric ID (permanent, unlike username). Stores name, email, avatar.

**Repository** — A GitHub repository associated with a user. Stores full name, GitHub repo ID, privacy status. Has many ScanResults.

**ScanResult** — The output of one scan on one PR. Stores pull request ID, commit SHA, status (PENDING / IN_PROGRESS / COMPLETED / FAILED). Has one RiskScore, many Findings.

**RiskScore** — The computed score for a ScanResult. Stores total score (0–100), classification enum, and a JSON breakdown of contribution data.

**Finding** — A single detected vulnerability. Stores category, description, file, line number, severity, confidence, and the original code snippet. Has one optional Remediation.

**Remediation** — The fix associated with a Finding. Stores type (AUTOMATIC or GUIDED), corrected code, and recommendation text.

**IgnoreRule (implemented as FalsePositive)** — A developer-created suppression for a specific finding type in a repository. Stores finding type, file path, code snippet, dismissing user ID, and a vector embedding for similarity-based future suppression.

**BaselineSnapshot (implemented as CodeEmbedding)** — Stores vector embeddings of code snippets per repository using the pgvector PostgreSQL extension. Fields: id, repositoryId, findingType, file, codeSnippet, embedding (vector 1536 dimensions), scanResultId, createdAt. Used by the Semantic Similarity Scanner and Codebase Memory system. Requires `pgvector` extension enabled in PostgreSQL.

**FalsePositive** — Raw pgvector table storing dismissed finding embeddings. Created manually (see BUGS.md MANUAL-002). Used by the false positive learning model.

**ScheduledScanLog** — Tracks scheduled full-repo scan execution. Stores repositoryId, status (STARTED / COMPLETED / FAILED), startedAt, completedAt. Used on server startup to re-queue any scans that started but never completed due to a server restart.

**ApiQuota** — Per-user monthly request and scan quota tracking. Stores periodStart, periodEnd, requestCount, scanCount, requestLimit, scanLimit.

**RuleSuggestion** — A user-submitted detection rule suggestion. Stores title, description, category, pattern, severity, status (PENDING / APPROVED / REJECTED), and a review note.

## 17. Boundaries & Exclusions

The system does not:

- Perform runtime security monitoring or intrusion detection
- Replace penetration testing or full security audits
- Guarantee detection of all possible vulnerabilities
- Analyze code that is not part of a pull request diff (except scheduled full-repo scans)
- Execute or deploy code
- Provide compliance certification

---