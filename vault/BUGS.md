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
Fix: write tests for each feature as it is completed from Stage 3 onwards.

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
