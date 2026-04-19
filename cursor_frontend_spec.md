# RedFlag CI — Complete Frontend Specification
# For Cursor AI Implementation

---

## 1. PROJECT IDENTITY

**RedFlag CI** is a production-grade automated security analysis tool for GitHub Pull Requests. It detects vulnerabilities in code changes (especially AI-generated code), evaluates risk, and provides automated or guided remediation — all delivered as PR comments AND through a web dashboard.

**Your role:** Rebuild the frontend to be a premium, CodeRabbit-quality web application. The current Cursor-generated code has the right theme/palette but uses irrelevant mock data, has no proper page routing depth, and lacks the real content that maps to our actual backend API and data model.

---

## 2. WHAT EXISTS ALREADY (DO NOT BREAK)

The following infrastructure was built by Cursor and works correctly. **Preserve all of it:**

### Working Infrastructure (Keep As-Is)
- `main.tsx` — App bootstrap with React Query, Auth Provider, BrowserRouter
- `state/auth/` — AuthContext, AuthProvider, RequireAuth (JWT localStorage flow)
- `lib/api.ts` — `apiFetch()` utility with Bearer token injection
- `index.css` — Complete design system (CSS variables, glass utilities, glow classes)
- `vite.config.ts`, `tsconfig.*.json` — Build configuration
- `api/dashboard.api.ts` — API fetch functions (stats, repositories)
- `api/dashboard.types.ts` — TypeScript types for API responses
- `hooks/useDashboardStats.ts`, `hooks/useRepositories.ts` — React Query hooks

### What Needs Rebuilding
- **ALL pages** (`LandingPage.tsx`, `DashboardPage.tsx`, `LoginPage.tsx`)
- **ALL UI components** in `ui/` directory
- **App.tsx** routing (needs more routes)
- **New API functions** for scan results and scan details
- **New hooks** for scan data
- **New pages** for repository detail and scan detail views

---

## 3. BACKEND API CONTRACT (THE REAL DATA)

The backend runs at `http://localhost:4000`. All `/api/dashboard/*` routes require JWT Bearer auth.

### Endpoint 1: `GET /api/dashboard/stats`
**Purpose:** Aggregate numbers for the dashboard overview.
**Response shape:**
```json
{
  "stats": {
    "totalRepos": 5,
    "totalScans": 23,
    "totalFindings": 47,
    "scansByRiskLevel": {
      "CRITICAL": 3,
      "HIGH": 8,
      "MEDIUM": 12,
      "LOW": 7,
      "CLEAN": 5
    }
  }
}
```

### Endpoint 2: `GET /api/dashboard/repositories`
**Purpose:** All repos belonging to the authenticated user.
**Response shape:**
```json
{
  "repositories": [
    {
      "id": "uuid",
      "githubRepoId": "123456",
      "name": "RedFlag-CI",
      "fullName": "nikhilvirdi/RedFlag-CI",
      "url": "https://github.com/nikhilvirdi/RedFlag-CI",
      "isPrivate": false,
      "createdAt": "2026-04-18T...",
      "updatedAt": "2026-04-20T...",
      "_count": { "scanResults": 7 }
    }
  ]
}
```

### Endpoint 3: `GET /api/dashboard/repositories/:repositoryId`
**Purpose:** Single repository detail with scan count.
**Response:** Same shape as one item from the list above.

### Endpoint 4: `GET /api/dashboard/repositories/:repositoryId/scans?page=1&pageSize=10`
**Purpose:** Paginated scan history for a specific repository.
**Response shape:**
```json
{
  "data": [
    {
      "id": "scan-uuid",
      "pullRequestId": "42",
      "commitSha": "abc1234def5678",
      "status": "COMPLETED",
      "createdAt": "2026-04-20T...",
      "updatedAt": "2026-04-20T...",
      "repositoryId": "repo-uuid",
      "riskScore": {
        "id": "score-uuid",
        "totalScore": 72.5,
        "classification": "HIGH",
        "contributionData": { ... }
      },
      "_count": { "findings": 4 }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalCount": 23,
    "totalPages": 3
  }
}
```

### Endpoint 5: `GET /api/dashboard/scans/:scanResultId`
**Purpose:** Full detail of a single scan — the "drill-down" report view.
**Response shape:**
```json
{
  "scanResult": {
    "id": "scan-uuid",
    "pullRequestId": "42",
    "commitSha": "abc1234",
    "status": "COMPLETED",
    "createdAt": "...",
    "repository": {
      "fullName": "nikhilvirdi/RedFlag-CI",
      "url": "https://github.com/..."
    },
    "riskScore": {
      "totalScore": 72.5,
      "classification": "HIGH",
      "contributionData": { ... }
    },
    "findings": [
      {
        "id": "finding-uuid",
        "category": "Credential Exposure",
        "description": "Hardcoded API key detected in source file",
        "file": "src/config/api.ts",
        "lineNumber": 14,
        "severity": "CRITICAL",
        "confidence": "HIGH",
        "codeSnippet": "const API_KEY = 'sk-live-abc123...'",
        "remediation": {
          "id": "rem-uuid",
          "type": "AUTOMATIC",
          "correctedCode": "const API_KEY = process.env.API_KEY",
          "recommendation": "Move all secrets to environment variables..."
        }
      }
    ]
  }
}
```

---

## 4. DATA MODEL (Prisma Schema — What the backend stores)

```
User (id, githubId, email, name, avatarUrl)
  └── Repository[] (id, githubRepoId, name, fullName, url, isPrivate)
        └── ScanResult[] (id, pullRequestId, commitSha, status[PENDING|IN_PROGRESS|COMPLETED|FAILED])
              ├── RiskScore (totalScore, classification[CRITICAL|HIGH|MEDIUM|LOW|CLEAN], contributionData)
              └── Finding[] (category, description, file, lineNumber, severity, confidence, codeSnippet)
                    └── Remediation (type[AUTOMATIC|GUIDED], correctedCode, recommendation)
```

---

## 5. COMPLETE ROUTE MAP

```
/                    → LandingPage (public, marketing + product demo)
/login               → LoginPage (GitHub OAuth trigger)
/auth/success        → AuthSuccessPage (OAuth callback, stores JWT)
/app                 → DashboardPage (protected, overview stats + repo list)
/app/repos/:id       → RepositoryDetailPage (protected, scan history for one repo)
/app/scans/:id       → ScanDetailPage (protected, full vulnerability report)
```

---

## 6. PAGE-BY-PAGE SPECIFICATION

### PAGE 1: Landing Page (`/`)

This is the marketing homepage. It must convince a developer to try RedFlag CI.
Inspired by CodeRabbit's structure: Hero → Social Proof → Feature Showcase → Demo → CTA.

#### Section A: Hero (Full viewport height)
- **Left column (55%):**
  - The `DotLogoConstruction` component (keep the existing canvas-based logo animation)
  - Headline: **"Catch AI-generated vulnerabilities before they ship"**
  - Subheadline: "RedFlag CI automatically scans every pull request for credential exposure, SQL injection, dependency risks, and prompt injection — then posts fixes directly in your PR."
  - Two CTA buttons: "Get Started Free" (cyan glow) → /login, "See How It Works" → scrolls to demo section
  - Three small pills/badges: "GitHub-native SAST", "Auto-remediation", "Risk Scoring"
- **Right column (45%):**
  - The `CodeScanSimulation` component (keep existing, it works well)

#### Section B: Proof Strip (Horizontal bar below hero)
- Four stat cards in a row. Since we're new, show capability descriptions:
  - "4 Analyzers" — Credential, SQL Injection, Dependency, Prompt Injection
  - "Dual Output" — PR Comments + Web Dashboard
  - "Risk Scoring" — Severity × Confidence weighted scoring
  - "Auto-Fix" — Deterministic remediation for safe patterns

#### Section C: Problem Statement
- Two-column layout:
  - **Left:** "AI writes code fast. But fast ≠ secure." — Explain the problem (AI-generated code contains hardcoded credentials, unsafe queries, suspicious dependencies, prompt injection vectors)
  - **Right:** "RedFlag CI catches what AI misses." — Explain our solution (AST-based analysis, pattern matching, contextual validation, structured remediation)

#### Section D: Feature Cards (3-column grid)
Real features from our projectDocs.md:

1. **Credential Exposure Detection**
   - "Detects hardcoded API keys, access tokens, private keys, and database credentials using pattern matching and entropy analysis."
   - Tag: "Critical" (red glow)

2. **SQL Injection Prevention**
   - "Identifies unsafe query construction patterns including string concatenation and improper user input handling."
   - Tag: "High" (red glow)

3. **Dependency Integrity Validation**
   - "Validates declared packages against trusted registries. Detects non-existent, typosquatted, or suspicious dependencies."
   - Tag: "Supply Chain" (cyan glow)

4. **Prompt Injection Analysis**
   - "Traces user-controlled input flowing into LLM interactions without proper validation or sanitization."
   - Tag: "AI-Specific" (cyan glow)

5. **Automated Remediation**
   - "For deterministic vulnerabilities, generates corrected code that follows secure coding practices without altering intended functionality."
   - Tag: "Auto-Fix" (cyan glow)

6. **Risk Scoring System**
   - "Severity × Confidence weighted scoring with qualitative classification. Critical issues dominate the score; uncertain findings are down-weighted."
   - Tag: "Scoring" (neutral)

#### Section E: How It Works (Workflow Steps — CodeRabbit-style narrative)
Vertical timeline or horizontal stepper with 5 steps:

1. **"Developer opens a PR"** — Icon: Git branch. "A pull request triggers RedFlag CI automatically via GitHub webhooks."
2. **"Code diff is extracted"** — Icon: File diff. "Only modified and new files are analyzed — no full-repo scans."
3. **"4 analyzers run in parallel"** — Icon: Shield. "Credential, SQL injection, dependency, and prompt injection analyzers execute concurrently."
4. **"Risk is scored"** — Icon: Gauge. "Each finding gets severity + confidence. An aggregate Security Risk Score is computed."
5. **"Results are delivered"** — Icon: Check. "A structured report is posted as a PR comment. Results are also stored for the dashboard."

#### Section F: The Security Diff Viewer Preview
Show the `SecurityDiffViewer` component with a REAL example:
- **Left pane (red):** Show a hardcoded credential: `const API_KEY = "sk-live-abc123def456"`
- **Right pane (cyan):** Show the fix: `const API_KEY = process.env.API_KEY`
- Caption: "Vulnerabilities in red. Fixes in cyan. No ambiguity."

#### Section G: CTA Footer
- "Ready to secure your PRs?"
- Two buttons: "Sign in with GitHub" → /login, "View Documentation" → /docs (or GitHub README)

---

### PAGE 2: Login Page (`/login`)

- Centered card on black background
- RedFlag CI logo (static, small version)
- "Sign in with GitHub" button (large, cyan glow border)
- Subtitle: "RedFlag CI uses GitHub OAuth. We request read access to your repositories."
- Privacy note: "We never store your code. Analysis is performed on code diffs only."

---

### PAGE 3: Auth Success Page (`/auth/success`)

- Catches the OAuth callback
- Extracts the JWT token from URL params
- Stores it in localStorage
- Shows a brief "Authenticated successfully" message
- Auto-redirects to `/app` after 1.5 seconds

---

### PAGE 4: Dashboard Overview (`/app`) — PROTECTED

This is the main operational page. It must show REAL data from the backend.

#### Layout Structure
- **TopNav** (full width): Logo (small) | "Dashboard" title | User avatar + name | Logout button
- **Main content** (max-width 1200px, centered):

#### Row 1: Stats Overview (3-column grid)
Uses `GET /api/dashboard/stats` data:
- **Card 1:** "Total Repositories" — `stats.totalRepos` — cyan glow
- **Card 2:** "Total Scans" — `stats.totalScans` — neutral
- **Card 3:** "Critical Findings" — `stats.scansByRiskLevel.CRITICAL ?? 0` — red glow if > 0

#### Row 2: Risk Distribution Chart
- A horizontal bar chart or small donut visualization showing `stats.scansByRiskLevel`
- Colors: CRITICAL=#ff0000, HIGH=#ff4444, MEDIUM=#ff8800, LOW=#ffcc00, CLEAN=#00fbff
- Caption: "Scan results by risk classification"

#### Row 3: Connected Repositories
Uses `GET /api/dashboard/repositories` data:
- Header: "Connected Repositories" with count badge
- Search/filter input (client-side filtering by repo name)
- Grid of `RepoCard` components (3 columns)

Each **RepoCard** must show:
- Repository `fullName` (e.g., "nikhilvirdi/RedFlag-CI")
- Private badge if `isPrivate === true`
- Scan count: `_count.scanResults` scans
- Last updated date
- **onClick:** Navigate to `/app/repos/:id` (NOT external GitHub link!)

#### Row 4: Recent Activity
- Show the 5 most recent scans across ALL repos (requires a new API call or client-side aggregation)
- Each item: Repo name | PR #pullRequestId | Risk classification badge | Time ago
- Click navigates to `/app/scans/:scanResultId`

---

### PAGE 5: Repository Detail (`/app/repos/:id`) — PROTECTED — NEW PAGE

#### Top Section
Uses `GET /api/dashboard/repositories/:repositoryId`:
- Repo name (large), GitHub URL link (external), Private badge
- Quick stats: Total scans count

#### Main Section: Scan History Table
Uses `GET /api/dashboard/repositories/:repositoryId/scans?page=1&pageSize=10`:
- A table/list showing all scans for this repo
- Columns:
  - **PR #** — `pullRequestId` (link format: `github.com/owner/repo/pull/{pullRequestId}`)
  - **Commit** — first 7 chars of `commitSha` (monospace font)
  - **Status** — Badge: PENDING (gray), IN_PROGRESS (cyan pulse), COMPLETED (white), FAILED (red)
  - **Risk Score** — `riskScore.totalScore` with color-coded `riskScore.classification` badge
  - **Findings** — `_count.findings` count
  - **Date** — `createdAt` formatted as relative time
- Each row is clickable → navigates to `/app/scans/:scanResultId`
- Pagination controls at bottom (page numbers, prev/next)

---

### PAGE 6: Scan Detail / Vulnerability Report (`/app/scans/:id`) — PROTECTED — NEW PAGE

This is the MOST IMPORTANT page. This is the full security report.

Uses `GET /api/dashboard/scans/:scanResultId`:

#### Header Bar
- Back button → return to repo detail
- Repo name (linked to GitHub)
- PR # and commit SHA
- Status badge
- Overall Risk Score (large number with classification badge)

#### Risk Summary Card (glass panel)
- Risk Score: `riskScore.totalScore` / 100
- Classification: `riskScore.classification` with color
- Visual: A circular progress gauge or score ring
- Contribution breakdown from `riskScore.contributionData` (if available)

#### Findings List
For each finding in `scanResult.findings` (sorted by severity):

**FindingCard** component:
```
┌──────────────────────────────────────────────────────┐
│ [CRITICAL]  Credential Exposure           HIGH conf. │
│                                                      │
│ Hardcoded API key detected in source file            │
│                                                      │
│ 📄 src/config/api.ts  Line 14                        │
│                                                      │
│ ┌─ Vulnerable Code (RED background) ──────────────┐  │
│ │ 14 │ const API_KEY = "sk-live-abc123..."        │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ ┌─ Remediation (CYAN background) ─────────────────┐  │
│ │ Type: AUTOMATIC                                 │  │
│ │ 14 │ const API_KEY = process.env.API_KEY        │  │
│ │                                                 │  │
│ │ Recommendation: Move all secrets to environment │  │
│ │ variables and use a .env file with dotenv...    │  │
│ └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

Each FindingCard shows:
- **Severity badge** — Color-coded (CRITICAL=red, HIGH=orange-red, MEDIUM=amber, LOW=gray)
- **Confidence badge** — HIGH/MEDIUM/LOW
- **Category** — e.g., "Credential Exposure", "SQL Injection", "Dependency Risk", "Prompt Injection"
- **Description** — Full text
- **File + Line Number** — Monospace, linked if possible
- **Code Snippet** — The vulnerable code in a red-tinted code block
- **Remediation:**
  - If `type === "AUTOMATIC"`: Show `correctedCode` in a cyan-tinted code block
  - If `type === "GUIDED"`: Show `recommendation` as formatted text
  - Badge indicating whether fix is automatic or guided

#### SecurityDiffViewer Integration
- For findings with AUTOMATIC remediation that have both `codeSnippet` AND `correctedCode`:
- Show the dual-pane `SecurityDiffViewer` component with:
  - Left (red): `finding.codeSnippet`
  - Right (cyan): `finding.remediation.correctedCode`

---

## 7. NEW FILES TO CREATE

### API Layer
```
src/api/dashboard.api.ts  — ADD: getRepositoryById(), getScanResults(), getScanDetail()
src/api/dashboard.types.ts — ADD: ScanResult, Finding, Remediation, RiskScore, Pagination types
```

### Hooks
```
src/hooks/useRepository.ts      — fetch single repo by ID
src/hooks/useScanResults.ts     — fetch paginated scans for a repo
src/hooks/useScanDetail.ts      — fetch full scan detail by ID
```

### Pages
```
src/pages/RepositoryDetailPage.tsx  — NEW
src/pages/ScanDetailPage.tsx        — NEW
```

### UI Components
```
src/ui/dashboard/RiskChart.tsx       — Risk distribution visualization
src/ui/dashboard/ScanHistoryTable.tsx — Tabular scan list with pagination
src/ui/dashboard/FindingCard.tsx     — Individual vulnerability display
src/ui/dashboard/RiskScoreBadge.tsx  — Color-coded risk level badge
src/ui/dashboard/StatusBadge.tsx     — Scan status indicator
src/ui/common/Pagination.tsx         — Reusable pagination controls
```

### Route Updates
```
src/App.tsx — Add routes:
  /app/repos/:repositoryId  → RepositoryDetailPage
  /app/scans/:scanResultId  → ScanDetailPage
```

---

## 8. TYPESCRIPT TYPES TO ADD

```typescript
// Add to dashboard.types.ts

export type ScanStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type RemediationType = 'AUTOMATIC' | 'GUIDED'

export type RiskScore = {
  id: string
  totalScore: number
  classification: RiskLevel
  contributionData: Record<string, unknown>
  scanResultId: string
}

export type Remediation = {
  id: string
  type: RemediationType
  correctedCode: string | null
  recommendation: string | null
  findingId: string
}

export type Finding = {
  id: string
  category: string
  description: string
  file: string
  lineNumber: number | null
  severity: RiskLevel
  confidence: ConfidenceLevel
  codeSnippet: string | null
  scanResultId: string
  remediation: Remediation | null
}

export type ScanResultSummary = {
  id: string
  pullRequestId: string
  commitSha: string
  status: ScanStatus
  createdAt: string
  updatedAt: string
  repositoryId: string
  riskScore: RiskScore | null
  _count: { findings: number }
}

export type ScanResultDetail = {
  id: string
  pullRequestId: string
  commitSha: string
  status: ScanStatus
  createdAt: string
  repository: {
    fullName: string
    url: string
  }
  riskScore: RiskScore | null
  findings: Finding[]
}

export type PaginationInfo = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}
```

---

## 9. DESIGN RULES (NON-NEGOTIABLE)

1. **Background:** `#000000` everywhere. No grays, no off-blacks.
2. **Text:** `#ffffff` for headings, `rgba(255,255,255,0.72)` for body, `rgba(255,255,255,0.56)` for meta.
3. **Red (#ff0000):** ONLY for vulnerabilities, critical alerts, and flags. Never decorative.
4. **Cyan (#00fbff):** ONLY for remediations, fixes, and secure states. Never decorative.
5. **Glass panels:** Every card uses the `.glass` and `.glass--panel` CSS classes from `index.css`.
6. **No mock data fallbacks:** If the API returns empty arrays, show proper empty states ("No repositories connected yet", "No scans found for this repository").
7. **Loading states:** Show skeleton loaders or "Loading..." with glass panels, never blank screens.
8. **Error states:** Show `.glow-red` glass panels with clear error messages and retry buttons.
9. **All data comes from the backend API.** No hardcoded numbers, no fake repo names, no placeholder scan results.
10. **The repository cards must link to `/app/repos/:id` internally, NOT to GitHub externally.** GitHub links go in detail pages only.

---

## 10. ANIMATION GUIDELINES

1. **Page transitions:** Subtle fade + translate-y (use Framer Motion).
2. **Card appearances:** Staggered entrance (each card delays 50ms after the previous).
3. **Hover effects:** Cards lift 2px with enhanced glow on hover. Use CSS transitions (180ms ease).
4. **Stat numbers:** Count-up animation when stats load (animate from 0 to actual value over 800ms).
5. **Status badges:** IN_PROGRESS status gets a subtle cyan pulse animation (CSS keyframes).
6. **Logo animation:** Keep the existing `DotLogoConstruction` canvas component exactly as-is.
7. **Code scan simulation:** Keep the existing `CodeScanSimulation` component exactly as-is.

---

## 11. IMPLEMENTATION PRIORITY

### Phase 1 (Must Complete First)
1. Update `App.tsx` with new routes
2. Add all new TypeScript types
3. Add new API functions and hooks
4. Build `RepositoryDetailPage` with `ScanHistoryTable`
5. Build `ScanDetailPage` with `FindingCard`

### Phase 2 (Polish)
6. Rebuild `LandingPage` with real content (not generic "SOC-grade" copy)
7. Rebuild `DashboardPage` with internal navigation and risk chart
8. Fix `RepoGrid` to navigate internally instead of linking to GitHub

### Phase 3 (Enhancement)
9. Add pagination component
10. Add search/filter for repositories
11. Add risk distribution chart
12. Add count-up animations for stats
