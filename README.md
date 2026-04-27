<div align="center">

<img src="https://img.shields.io/badge/Status-Active%20Development-brightgreen?style=for-the-badge" />
<img src="https://img.shields.io/badge/License-Educational%20%26%20Development-orange?style=for-the-badge" />
<img src="https://img.shields.io/badge/Category-AI--Native%20Security%20Analysis-red?style=for-the-badge" />
<img src="https://img.shields.io/badge/Backend-Express.js-404D59?style=for-the-badge&logo=express&logoColor=white" />
<img src="https://img.shields.io/badge/Frontend-Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
<img src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Runtime-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
<img src="https://img.shields.io/badge/Scan%20Engine-Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/Static%20Analysis-Semgrep-2557F6?style=for-the-badge" />
<img src="https://img.shields.io/badge/Secrets-TruffleHog-D32F2F?style=for-the-badge" />
<img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/ORM-Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
<img src="https://img.shields.io/badge/Cache-Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
<img src="https://img.shields.io/badge/Auth-GitHub%20OAuth-181717?style=for-the-badge&logo=github&logoColor=white" />
<img src="https://img.shields.io/badge/Session-JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" />
<img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" />
<img src="https://img.shields.io/badge/Containers-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
<img src="https://img.shields.io/badge/Monitoring-Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white" />
<img src="https://img.shields.io/badge/Observability-Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white" />
<img src="https://img.shields.io/badge/Testing-Jest-C21325?style=for-the-badge&logo=jest&logoColor=white" />
<img src="https://img.shields.io/badge/API-Supertest-0F172A?style=for-the-badge" />
<img src="https://img.shields.io/badge/State-Zustand-443E38?style=for-the-badge" />
<img src="https://img.shields.io/badge/Data%20Fetching-TanStack%20Query-FF4154?style=for-the-badge&logo=reactquery&logoColor=white" />
<img src="https://img.shields.io/badge/Forms-React%20Hook%20Form-EC5990?style=for-the-badge&logo=reacthookform&logoColor=white" />
<img src="https://img.shields.io/badge/Styling-Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/HTTP-Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white" />

# RedFlag-CI

### AI-native security analysis for modern CI/CD pipelines.

RedFlag-CI is a pull request security analysis engine that scans code changes
to detect vulnerabilities in both AI-generated and human-written code before
they are merged. It combines pattern-based detection, context-aware analysis,
risk scoring, remediation support, GitHub PR feedback, and dashboard visibility
into a single workflow-integrated system. [file:30]

[Report Bug](https://github.com/nik/redflag-ci/issues) · [Request Feature](https://github.com/nik/redflag-ci/issues) · [Documentation](#documentation)

</div>

---

## Table of Contents

- [The Problem](#the-problem)
- [What is RedFlag-CI](#what-is-redflag-ci)
- [Who It Is For](#who-it-is-for)
- [How It Works](#how-it-works)
- [Features](#features)
- [Architecture](#architecture)
- [Risk Scoring](#risk-scoring)
- [Vulnerability Coverage](#vulnerability-coverage)
- [Auto-Remediation Policy](#auto-remediation-policy)
- [Tech Stack](#tech-stack)
- [Limitations](#limitations)
- [Future Scope](#future-scope)
- [Documentation](#documentation)
- [License](#license)

---

## The Problem

AI-assisted development has accelerated software delivery, but it has also
introduced a new class of security risks that traditional tooling does not
consistently detect or prioritize. AI-generated code can include hardcoded
credentials, unsafe query construction, insecure dependency usage, and
improper handling of user-controlled input in LLM-related flows. [file:30]

Most teams still rely on generic static analysis or manual review, which can
miss vulnerabilities specific to AI-generated patterns or fail to present them
in a way that is actionable during code review. In fast-moving repositories,
that means risky code can be merged before anyone understands its security
impact. [file:30]

RedFlag-CI is built to close that gap.

---

## What is RedFlag-CI

RedFlag-CI is an AI-native security analysis system designed for pull request
workflows. It automatically analyzes code changes, detects high-impact
vulnerabilities, assigns a security risk score, and provides either safe
automatic remediation or structured guidance for manual fixes. [file:30]

The system operates directly inside the developer workflow through GitHub
events and PR comments, while also storing results in a backend and exposing
them through a web dashboard for historical review, repository tracking, and
report access. [file:30]

---

## Who It Is For

- Developers using AI coding tools who want security checks before merge. [file:30]
- Small teams that ship quickly but do not have dedicated AppSec capacity. [file:30]
- Projects that want actionable PR feedback instead of noisy generic scans. [file:30]
- Teams that need both inline review comments and centralized scan visibility. [file:30]
- Builders who want safer AI-assisted development without slowing delivery. [file:30]

---

## How It Works

1. A pull request is opened or updated in GitHub. [file:30]
2. RedFlag-CI retrieves the changed files and relevant code context. [file:30]
3. The system checks for AI-generated patterns and prepares the code for targeted analysis. [file:30]
4. Multiple analyzers run in parallel to detect security issues across different categories. [file:30]
5. Findings are evaluated by severity and confidence, then aggregated into a unified risk score. [file:30]
6. Safe issues receive deterministic remediation; complex issues receive structured recommendations. [file:30]
7. A formatted security report is posted back to the pull request and persisted for dashboard access. [file:30]

---

## Features

### Pull Request Security Analysis
- Automatic scanning on pull request creation and updates. [file:30]
- Analysis focused on changed code rather than full-repository deep scans. [file:30]
- Tight integration with the existing code review workflow. [file:30]

### AI-Aware Detection
- Identification of AI-generated code patterns before deeper analysis. [file:30]
- Targeted checks for vulnerability classes commonly introduced by AI-assisted coding. [file:30]
- Combination of deterministic pattern matching and contextual validation. [file:30]

### Vulnerability Detection
- Credential and secret exposure detection. [file:30]
- Query security analysis for unsafe string construction and injection risks. [file:30]
- Dependency integrity validation against trusted sources. [file:30]
- Prompt injection risk analysis for unsafe user-input flow into model interactions. [file:30]

### Risk Intelligence
- Unified Security Risk Score for each analyzed change set. [file:30]
- Severity and confidence scoring for every finding. [file:30]
- Prioritization that emphasizes high-impact, high-confidence issues. [file:30]

### Remediation Support
- Automatic remediation for deterministic and safe scenarios. [file:30]
- Guided remediation for cases that require developer judgment. [file:30]
- Structured recommendations with issue explanation, impact, and fix guidance. [file:30]

### Output and Visibility
- Pull request comment delivery for immediate reviewer feedback. [file:30]
- Structured reports with findings, vulnerable code, remediated code, and action items. [file:30]
- Web dashboard for repository summaries, scan history, and detailed report review. [file:30]

### Reliability and Noise Control
- Confidence-based filtering to reduce false positives. [file:30]
- Grouping and elimination of redundant findings where possible. [file:30]
- Developer control for dismissing or ignoring specific findings in review context. [file:30]

---

## Architecture

RedFlag-CI is organized as a modular pipeline with separated detection,
scoring, remediation, output, backend API, persistence, and frontend
presentation responsibilities. This separation allows the analysis engine,
delivery layer, and dashboard layer to evolve independently while preserving
a stable data flow. [file:30]

```text
┌───────────────────────────────────────────────────────────────┐
│ GitHub Pull Request Events                                   │
│ Opened / Updated via Webhooks                                │
└──────────────────────────────┬────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────┐
│ Backend Orchestrator (Node.js + Express.js + TypeScript)     │
│ Routing · Auth · Repository Management · Scan Coordination    │
└───────────────┬───────────────────────┬───────────────────────┘
                │                       │
                │                       │
┌───────────────▼──────────────┐   ┌───▼───────────────────────┐
│ Detection Layer              │   │ Integration Layer          │
│ AI Pattern Identification    │   │ GitHub App / REST API      │
│ Security Analyzers           │   │ PR Comments / Repo Access  │
└───────────────┬──────────────┘   └───────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ Scan Engine (Python)                                         │
│ Semgrep · TruffleHog · AST Analysis · Regex / Context Rules  │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────┐
│ Scoring Layer                │
│ Severity · Confidence · Risk │
└───────────────┬──────────────┘
                │
┌───────────────▼──────────────┐
│ Remediation Layer            │
│ Auto Fixes · Guided Fixes    │
└───────────────┬──────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ Output Layer                                                 │
│ PR Report · Stored Scan Result · API Response                │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ Data Layer                                                   │
│ PostgreSQL · Prisma · Redis (optional)                       │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ Web Dashboard (Next.js)                                      │
│ Repositories · Reports · History · Risk Visibility           │
└──────────────────────────────────────────────────────────────┘
```

### Core Layers
- **Detection Layer** identifies vulnerabilities using specialized analyzers and contextual checks. [file:30]
- **Scoring Layer** converts findings into severity-weighted, confidence-adjusted risk. [file:30]
- **Remediation Layer** decides between deterministic auto-fix and guided remediation. [file:30]
- **Output Layer** compiles PR-ready reports and dashboard-consumable results. [file:30]
- **Frontend Layer** presents repository summaries, reports, and historical scans without performing analysis itself. [file:30]

---

## Risk Scoring

Every finding is assigned both a severity level and a confidence level, and the
system aggregates those values into an overall Security Risk Score for the
pull request. The score is designed so that a small number of critical issues
can dominate the outcome, while multiple lower-severity issues can still
accumulate into meaningful risk. [file:30]

### Severity Levels
- **Critical** — severe impact such as full compromise, major breach, or unauthorized access with low barriers. [file:30]
- **High** — serious exploitable issues with significant security consequences. [file:30]
- **Medium** — moderate risks requiring more specific conditions or context. [file:30]
- **Low** — lower-impact issues, often informational or best-practice related. [file:30]

### Confidence Levels
- **High confidence** — strong evidence and minimal ambiguity. [file:30]
- **Medium confidence** — probable issue with some uncertainty. [file:30]
- **Low confidence** — weak indicators or partial matches. [file:30]

### Scoring Intent
- Critical issues should sharply raise the overall score. [file:30]
- Confidence should reduce the influence of uncertain findings. [file:30]
- The final score should remain interpretable across different code changes. [file:30]
- The result should support fast prioritization during code review. [file:30]

---

## Vulnerability Coverage

RedFlag-CI focuses on high-impact vulnerability classes that are common in
modern development workflows and especially relevant to AI-assisted code
generation. The pattern library is extensible so new rules and attack vectors
can be added over time. [file:30]

| Category | What RedFlag-CI Detects |
|---|---|
| Credential Exposure | Hardcoded API keys, tokens, private keys, and database credentials in code. [file:30] |
| Query Security | Unsafe string concatenation, unparameterized query patterns, and injection-prone construction. [file:30] |
| Dependency Integrity | Invalid, suspicious, or untrusted dependencies that may introduce supply chain risk. [file:30] |
| Prompt Injection Risk | Unsafe flow of user-controlled input into model interactions without proper validation or sanitization. [file:30] |

### Detection Approach
- Rule-based matching for deterministic detection. [file:30]
- Structural analysis of code constructs. [file:30]
- Context-aware validation to reduce false positives. [file:30]
- Extensible pattern libraries for new vulnerability classes. [file:30]

---

## Auto-Remediation Policy

RedFlag-CI does not try to auto-fix everything. It only generates automatic
remediation when the fix is deterministic, safe, and unlikely to alter
business logic. That design keeps the system useful without making risky
security edits on behalf of the developer. [file:30]

### Safe Automatic Fixes
- Replace hardcoded credentials with environment variable references. [file:30]
- Convert unsafe query construction into parameterized query patterns. [file:30]

### Guided Remediation
For complex vulnerabilities, the system provides:
- Clear issue descriptions. [file:30]
- Impact explanations. [file:30]
- Exact affected location references. [file:30]
- Actionable manual fix guidance. [file:30]

### Safety Constraints
Automatic remediation is avoided when:
- Application-specific logic must be understood first. [file:30]
- Authentication or authorization behavior may be affected. [file:30]
- Multiple valid solutions exist. [file:30]
- The system cannot safely determine one correct fix. [file:30]

---

## Tech Stack

| Category | Technologies |
|---|---|
| Backend | Node.js, Express.js, TypeScript [file:30] |
| Frontend | Next.js, TypeScript, Tailwind CSS, Zustand, TanStack Query, React Hook Form, Axios [file:30] |
| Database | PostgreSQL, Prisma, pg (optional) [file:30] |
| Scan Engine | Python, Semgrep, TruffleHog, Python AST, Regex [file:30] |
| Integration | GitHub OAuth, JWT, GitHub App, GitHub Webhooks, GitHub REST API [file:30] |
| Caching | Redis, ioredis (optional) [file:30] |
| Execution Model | Node.js async/promises, child processes, event-driven task handling [file:30] |
| DevOps | Docker, Docker Compose, Railway or Render, AWS (future-ready) [file:30] |
| CI/CD | GitHub Actions, ESLint, Prettier, dotenv [file:30] |
| Observability | Winston, Morgan, Prometheus, Grafana [file:30] |
| Testing | Jest, Supertest [file:30] |
| Developer Tooling | VS Code, Git, GitHub, Postman, pgAdmin, Prisma Studio [file:30] |

---

## Limitations

RedFlag-CI is designed to improve security review quality during development,
not to replace full audits, penetration testing, or runtime security systems.
Its analysis is strongest for well-defined code-level risks and may be less
effective for novel attack chains, deep business-logic issues, or
runtime-dependent vulnerabilities. [file:30]

Automatic remediation is intentionally limited to safe scenarios, and the
accuracy of results depends on both code context and the quality of the input
changes being scanned. The dashboard also depends on stored scan history, so
it does not act as a universal on-demand deep scanner for unprocessed
repositories. [file:30]

---

## Future Scope

The attached project documentation outlines several directions for expansion,
including broader vulnerability coverage, deeper contextual analysis across
files and workflows, richer risk intelligence, more advanced remediation
capabilities, and wider integration with development tools. It also emphasizes
continuous adaptation of detection patterns as developer workflows and threat
landscapes evolve. [file:30]

Potential next steps include:
- Multi-file and multi-step vulnerability reasoning. [file:30]
- Better trend analysis and repository-level security insights. [file:30]
- Expanded automatic remediation support. [file:30]
- Additional workflow and platform integrations. [file:30]
- Feedback-driven detection improvements over time. [file:30]

---

## Documentation

| Document | Description |
|---|---|
| `PROJECT-DOCS.md` | Detailed project specification, workflow, architecture, scoring, remediation, data model, and future scope. [file:30] |
| `README.md` | Public-facing overview, feature summary, setup, and high-level architecture. |
| `SECURITY.md` | Vulnerability disclosure process and project security expectations. |
| `CONTRIBUTING.md` | Contribution workflow, conventions, and code quality expectations. |
| `API.md` | Backend API routes, authentication flow, and response structure. |

---

## License

This project is intended for educational and development purposes, and its
final licensing model can be defined based on usage and distribution
requirements. [file:30]

---

<div align="center">

Built for secure velocity. Designed for modern pull requests. Focused on code before merge.

**RedFlag-CI** — Catch risky code before it ships.

</div>
