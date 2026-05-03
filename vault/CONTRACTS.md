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
- Write tests in the same session as implementation
- Update vault at end of session
- Use exact version pinning for dependencies
- Use crypto.randomBytes() for tokens
- Use python3 not python in spawn calls
