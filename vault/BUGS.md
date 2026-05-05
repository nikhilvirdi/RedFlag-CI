# Known Bugs and Tech Debt

## RESOLVED ✅

### BUG-001: python vs python3 in spawn call
- **Fixed**: spawn('python3', ...) used in `scan.service.ts`.

### BUG-002: Repository never created on GitHub App install
- **Fixed**: Added `installation.created` and `installation_repositories` handlers in `webhook.controller.ts`.

### BUG-003: repository.connect fallback to empty string
- **Fixed**: Throw error if repository not found in `scan.service.ts`.

### BUG-004: Redis not validated in env.ts
- **Fixed**: Added `REDIS_HOST` and `REDIS_PORT` to `requiredVariables` in `env.ts`.

### BUG-005: require() inside function body in auth.controller.ts
- **Fixed**: Moved imports to top-level in `auth.controller.ts`.

### BUG-006: Wrong ScanFinding field names in Stage 4 analyzers (runtime crash)
- **Files**: `async_concurrency_analyzer.py`, `dangerous_pattern_analyzer.py`, `input_validation_analyzer.py`, `hallucinated_package_analyzer.py`
- **Problem**: Used non-existent fields (`file_path`, `line_number`, `column_number`, `rule_id`, `context`) instead of the schema-correct fields from `models.py`.
- **Fixed**: All `ScanFinding` instantiations now use: `type`, `severity`, `confidence`, `file`, `line`, `description`, `original_code`, `recommendation` (optional), `remediated_code` (optional).

### BUG-007: Wrong DiffFile import in async_concurrency_analyzer.py
- **Problem**: `DiffFile` was imported from `models` — it does not exist there. Must be imported from `diff_parser`.
- **Fixed**: Import corrected to `from diff_parser import DiffFile`.

### BUG-008: Dead code block in async_concurrency_analyzer.py
- **Problem**: Residual dead block `if 'async' in line.content and 'function' in line.content: pass` was left after refactor.
- **Fixed**: Block removed entirely.

### BUG-009: Missing exception handling in all Stage 4 analyzers
- **Problem**: Any unhandled exception inside `analyze()` would propagate up and crash the scan engine pipeline.
- **Fixed**: All `analyze()` functions now wrap their main logic in `try/except Exception`, logging the error to `stderr` and returning the partial (or empty) findings list instead of crashing.
- **Note**: `dead_code_analyzer.py` and `hallucinated_package_analyzer.py` were incorrectly listed as fixed in the prior session — top-level wrap was missing. Corrected in Session 9.
- **Files fixed**: `async_concurrency_analyzer.py`, `dangerous_pattern_analyzer.py`, `input_validation_analyzer.py`, `credential_analyzer.py`, `sql_injection_analyzer.py`, `dependency_analyzer.py`, `prompt_injection_analyzer.py`, `ai_fingerprint_analyzer.py`, `environment_boundary_analyzer.py`, `auth_pattern_analyzer.py`, `crypto_analyzer.py`, `dead_code_analyzer.py`, `hallucinated_package_analyzer.py`.

### BUG-010: Invalid confidence values in ai_fingerprint_analyzer.py
- **Problem**: Confidence values were set to `'confidence_high'` and `'confidence_medium'` — not valid schema values.
- **Fixed**: Replaced with `'high'` and `'medium'` respectively.

## CRITICAL — Fix Before Stage 3
(None)

## TECH DEBT — Fix in Stage 8

### DEBT-001: OAuth state in-memory Map
Issue: does not work across multiple server instances.
Fix: move to Redis SET with TTL in Stage 8.

### DEBT-002: No rate limiting on any endpoint
Issue: webhook endpoint can be flooded. Auth endpoints have no brute force protection.
Fix: add express-rate-limit in Stage 8.

### DEBT-003: No tests written
Issue: Jest and Supertest are in package.json but zero tests exist.
Fix: Tests are written exclusively in Stage 8. Do not write any tests before that.

### DEBT-004: dashboard.routes.ts not confirmed to exist
Issue: app.ts mounts dashboardRouter but file was not visible in folder structure audit.
Fix: confirm file exists and exports dashboardRouter correctly.

### DEBT-005: DEBT-003 (tests) note is incorrect — tests are Stage 8 only
Issue: DEBT-003 says "write tests as each feature is completed from Stage 3 onwards." This contradicts AGENT_WORKPLAN.md which locks tests to Stage 8.
Fix: Tests are written exclusively in Stage 8. Do not write any tests before that.

## ENVIRONMENT ISSUES

### ENV-001: Windows PowerShell sandbox failure in Antigravity agent
Issue: run_command tool fails with "sandboxing is not supported on Windows" — agent cannot execute shell or git commands.
Impact: git operations (add, commit, push, rm) must be run manually by the user in terminal.
Status: Ongoing. Not a codebase issue. Work around by user running git commands directly.

## MANUAL STEPS — Required Before Production Deploy

### MANUAL-001: pgvector extension and CodeEmbedding table must be created manually
- **Stage introduced**: Stage 5 Task 3
- **Risk**: If this step is skipped, memory.service.ts will fail on every storeEmbeddings and detectRegressions call. Scans will degrade gracefully (warnings only), but no regression detection or similarity scanning will work.
- **Why manual**: Prisma does not support auto-migrating `Unsupported("vector(1536)")` columns via `prisma migrate dev`. The extension and table must be created with raw SQL before running the application in production.
- **Required SQL (run once against production PostgreSQL)**:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "CodeEmbedding" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "repositoryId" TEXT NOT NULL,
  "findingType"  TEXT NOT NULL,
  file           TEXT NOT NULL,
  "codeSnippet"  TEXT NOT NULL,
  embedding      vector(1536) NOT NULL,
  "scanResultId" TEXT NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS code_embedding_repo_idx ON "CodeEmbedding" ("repositoryId");
```
- **Status**: Pending. Must be executed by operator before Stage 5 features go live.
