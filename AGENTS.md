# AGENTS.md

This file is the entry point for any AI coding agent working on RedFlag CI, whether that's Claude Code, one of the Antigravity models, Codex, or anything else. Read it fully before touching any code.

## What this project is

RedFlag CI is a GitHub App that flags risky changes to AI agent configuration files inside pull requests: new MCP servers, widened permissions, swapped tool versions, and hidden-character injection in rule files. Full detail lives in `architecture.md`. Don't work from a summary; read that file directly.

## Where the real plan lives

- `architecture.md` is the complete reference: every component, every decision, the exact behavior of each detector, the reasoning behind each choice, and the full four-version roadmap.
- `workplan.md` is the execution checklist, structured as Version → Phase → Task. Work through it top to bottom, one task at a time.

## The rule that matters most

This project has four planned releases, v1 through v4. Only v1 is active right now. Do not write, scaffold, or reference code for v2, v3, or v4 unless the user has explicitly said that version is now active. `workplan.md` marks each version's status directly. If it's unclear whether something belongs in the current version, stop and ask instead of guessing.

## How to work

- One task from `workplan.md` per session. Don't batch several tasks together, even small ones; smaller diffs are easier to review and easier to get right the first time.
- Each task carries an acceptance criterion. Treat it as the definition of done, not a suggestion.
- Detectors in this project are pure functions: given a before-state and after-state of a file, they return a list of findings. Write them that way, and write the test fixture in the same task as the detector, not afterward.
- Stick to the tech stack fixed in `architecture.md`. If a task seems to need something outside it, flag that to the user before adding a new dependency.

## Conventions

- Commits follow Conventional Commits: `feat:` for a new feature or detector, `fix:` for a bug fix, `test:` for test-only changes, `docs:` for documentation, `chore:` for tooling or dependencies. This keeps the changelog generatable from git history and makes version bumps predictable.
- Branching is trunk-based. `main` stays deployable; work happens on short-lived `feature/*` branches. Release branches (`release/vX.Y.Z`) get cut only when stabilizing a pre-release candidate.
- Before considering any task done: `npm run lint` and `npm test` both pass, and if the change touches a detector, a fixture file exists for both the triggering and non-triggering case.
- TypeScript throughout, strict mode on.
- Every detector needs a passing test before its task counts as complete.

## Claude Code specifics

See `CLAUDE.md`.