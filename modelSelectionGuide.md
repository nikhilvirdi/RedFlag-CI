| Task | Model |
|------|-------|
| Fixing bugs (BUG-001 to BUG-005) | Gemini 3.1 Pro (High) |
| Writing new analyzers (Stage 4) | Gemini 3.1 Pro (High) |
| Intelligence layer / LLM integration (Stage 5) | Claude Sonnet 4.6 (Thinking) |
| Vulnerability chaining engine | Claude Sonnet 4.6 (Thinking) |
| Complex architectural decisions | Claude Opus 4.6 (Thinking) |
| Boilerplate / repetitive code (routes, controllers) | Gemini 3.1 Pro (Low) |
| Schema updates / Prisma migrations | Gemini 3.1 Pro (Low) |
| Writing tests (Jest / Supertest) | Gemini 3.1 Pro (Low) |
| Vault file updates | Gemini 3 Flash |
| Simple one-off fixes / typos | Gemini 3 Flash |

**Logic behind it:**
- **Gemini 3.1 Pro High** — your main workhorse for real implementation tasks
- **Claude Thinking models** — only when deep reasoning is needed (chaining logic, LLM integration design)
- **Gemini Low / Flash** — fast, cheap tasks that don't need heavy reasoning

- Tell me when to use which model. before each new task, check if it needs Claude or Gemini. and tell me why.