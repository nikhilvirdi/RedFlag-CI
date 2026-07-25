# CLAUDE.md

Full project context lives in `AGENTS.md`. Read that first.

## Notes specific to Claude Code

- Run the test suite after every task, not just at the end of a phase: `npm test` from `backend/`.
- When a task touches a detector, write the fixture files (a before/after pair of the config file being tested) in the same commit as the detector code, under `backend/src/detectors/__fixtures__/`.
- If a task's acceptance criterion in `workplan.md` is ambiguous, ask before implementing. A wrong guess here tends to compound across later tasks, since each phase builds on the last.