**Last Updated:** 2026-04-20
**Status:** Frontend Dashboard COMPLETE (Phase 1-3); High-Fidelity API Integration STABLE.

---

## 🎯 Core Mission & Goals
1.  **Engineering Mastery:** Move beyond "vibecoding" to deep-dive into System Design, Security, and DevOps.
2.  **Resume-Worthy Project:** Build an elite, production-grade CI security tool that actually solves a real-world problem (detecting vulnerabilities in PRs).
3.  **Service-Oriented:** Solve the real issue of "Shadow Credentials" and "Prompt Injection" in modern AI/Cloud apps.

---

## 🏗️ Architectural Blueprint
-   **Backend:** Node.js + TypeScript (Express) on Port 4000.
-   **Frontend:** React + TypeScript + Vite on Port 5173/5174.
-   **Database:** PostgreSQL (via Prisma ORM).
-   **Task Queue:** BullMQ + Redis (Asynchronous scan orchestration).
-   **Security Engine:** Python 3.x (AST analysis for SAST).
-   **Design:** Custom Glassmorphism + Dark Mode (Pure #000000).

---

## ✅ Progress & Milestones (What we've built)
-   [x] **Infrastructure:** Docker-compose for Postgres (5434) and Redis (6380).
-   [x] **Database:** Full Prisma schema for Users, Repos, Scans, and Findings.
-   [x] **Scan Pipeline:** BullMQ producer/worker system that triggers Python scans.
-   [x] **Security Engine:** AST-based analyzers for Credentials, SQLi, and Dependencies.
-   [x] **Auth Layer:** Complete GitHub OAuth flow and JWT middleware.
-   [x] **Dashboard API:** REST endpoints for stats, repo lists, and scan details.
-   [x] **Frontend Foundation:** React Router v6, TanStack Query v5, Zustand.
-   [x] **Frontend UI:** High-fidelity Glassmorphism design system.
-   [x] **Frontend Polish:** Count-up animations, animated risk charts, and responsive layouts.

---

## 🏆 Recent Wins: Frontend "Phase 3" Mastery
We successfully transitioned from mock prototypes to a production-ready dashboard.
-   **Real Data:** Scanned actual backend endpoints to populate `GlassStats` and `RepoCard`.
-   **Drill-down:** Implemented full navigation depth: Dashboard → Repository → Scan Result.
-   **Security UX:** Built the `SecurityDiffViewer` to visualize vulnerabilities (Red) vs Remediations (Cyan).
-   **Performance:** Optimized with TanStack Query caching and Framer Motion staggered animations.

---

## 🛠️ Key Technical Patterns to Remember
-   **Signal-First Design:** Red (#ff0000) = Danger; Cyan (#00fbff) = Secure. No ambiguity.
-   **Glass Panel Identity:** Background `rgba(255,255,255,0.03)`, Blur `12px`, Border `rgba(255,255,255,0.10)`.
-   **Deterministic Remediation:** Use `correctedCode` if type is `AUTOMATIC` to show diffs.
-   **Type Safety:** Strict TypeScript interfaces for all API responses to ensure front-back alignment.

---

## 🚀 Next Steps (Logo & Final Polish)
1.  **Rubik Maze Logo:** Implement the custom "RedFlag CI" logo using the Rubik Maze font (Red/White split).
2.  **Deployment Prep:** Finalize Dockerfile for the frontend and production nginx config.
3.  **Landing Page Polish:** Final review of the marketing copy and scroll-into-view interactions.
