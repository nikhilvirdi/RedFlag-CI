# 🧠 RedFlag CI - Project Memory & Context
**Last Updated:** 2026-04-20
**Status:** Backend Infrastructure STABLE; Commencing Frontend Development.

---

## 🎯 Core Mission & Goals
1.  **Engineering Mastery:** Move beyond "vibecoding" to deep-dive into System Design, Security, and DevOps.
2.  **Resume-Worthy Project:** Build an elite, production-grade CI security tool that actually solves a real-world problem (detecting vulnerabilities in PRs).
3.  **Service-Oriented:** Solve the real issue of "Shadow Credentials" and "Prompt Injection" in modern AI/Cloud apps.

---

## 🏗️ Architectural Blueprint
-   **Backend:** Node.js + TypeScript (Express).
-   **Database:** PostgreSQL (via Prisma ORM).
-   **Task Queue:** BullMQ + Redis (Asynchronous scan orchestration).
-   **Security Engine:** Python 3.x (AST analysis forSAST).
-   **IPC:** Node `spawn` and `stdin/stdout` streaming to Python.
-   **Authentication:** GitHub OAuth 2.0 with JWT Sessions.
-   **Infrastructure:** Dockerized local dev environment (Postgres/Redis).

---

## ✅ Progress & Milestones (What we've built)
-   [x] **Infrastructure:** Docker-compose for Postgres (5434) and Redis (6380).
-   [x] **Database:** Full Prisma schema for Users, Repos, Scans, and Findings.
-   [x] **Scan Pipeline:** BullMQ producer/worker system that triggers Python scans.
-   [x] **Security Engine:** AST-based analyzers for Credentials and Dependencies.
-   [x] **Auth Layer:** Complete GitHub OAuth flow and JWT middleware.
-   [x] **Dashboard API:** REST endpoints for stats, repo lists, and scan results.

---

## 🏆 Recent Wins & Resolution: The Octokit ESM Conflict
We successfully resolved the `ERR_PACKAGE_PATH_NOT_EXPORTED` crash.
-   **Solution:** Downgraded `@octokit/app` to `^14.0.0` and `@octokit/rest` to `^19.0.0`.
-   **Rationale:** These are the last versions that support CommonJS (our project type) natively without requiring a complete ESM migration of the entire codebase.
-   **Result:** Server now boots successfully on port 4000.

---

## 🛠️ Key Technical Patterns to Remember
-   **Fail-Fast Envs:** `env.ts` crashes the server if `.env` is missing keys.
-   **Singleton Prisma:** Shared database connection pool on `globalThis`.
-   **Deterministic IDs:** Job IDs in BullMQ prevent duplicate scans.
-   **Nested Connect:** Scan results link to Repositories via ID lookups.

---

## 🚀 Next Steps (Dashboard Phase)
1.  **Initialize Frontend:** Run `npm create vite@latest frontend -- --template react-ts`.
2.  **Implementation:** Follow the **Cursor Master Plan** to build the high-precision Logo Animation and Glassmorphism UI.
3.  **Core Feature:** Build the **Security Diff Viewer** for visualizing AST-analysis findings.
