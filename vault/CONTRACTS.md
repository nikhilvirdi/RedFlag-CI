# Agent Contracts — Non-Negotiable Rules

See Section 6 of AGENT_WORKPLAN.md for the full contract.

## Quick Reference

NEVER:
- Hardcode secrets or credentials
- Disable auth, SSL, or CORS
- Use string concatenation for SQL
- Pass user input directly to LLM prompts
- Use Math.random() for security values
- Log sensitive data
- Execute LLM output
- Use require() inside functions
- Use any type without justification comment
- Leave floating Promises
- Return null as an error signal from services
- Use prisma db push in production
- Add unverified dependencies

ALWAYS:
- Throw from services, catch in controllers with next(error)
- Use parameterized queries
- Validate external input at boundaries
- Update vault at end of session
- Use exact version pinning for dependencies
- Use crypto.randomBytes() for tokens
- Use python3 not python in spawn calls

## Stage 7 API Surface

Notifications:
- GET /api/notifications/repositories/:repositoryId/notifications
- POST /api/notifications/repositories/:repositoryId/notifications
- DELETE /api/notifications/repositories/:repositoryId/notifications

Outbound Webhooks:
- POST /api/outbound-webhooks
- GET /api/outbound-webhooks
- DELETE /api/outbound-webhooks/:id

Rules:
- GET /api/rules (public)
- POST /api/rules/suggest
- GET /api/rules/suggestions
- PATCH /api/rules/suggestions/:id/approve
- PATCH /api/rules/suggestions/:id/reject

Dashboard Extensions:
- GET /api/dashboard/repositories/:id/sarif
- GET /api/dashboard/repositories/:id/precommit-config

Badge:
- GET /api/badge/:repositoryId (public, SVG)

Audit:
- GET /api/audit-log

## Stage 8 Rate Limits

Global API: 100 req/15min (Redis-backed)
Auth routes: 20 req/15min
Webhook ingest: 60 req/min
Badge endpoint: 120 req/min
Claude API: 60 calls/hour, 500k tokens/hour, circuit breaker at 5 failures
User quota: 1000 API requests/month, 100 scans/month (ApiQuota table)
