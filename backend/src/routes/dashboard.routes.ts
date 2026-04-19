/**
 * Dashboard Routes
 * ─────────────────
 *
 * Binds HTTP method + path pairs to their controller handlers, with the
 * `authenticate` middleware guarding every route in this router.
 *
 * Mounted in app.ts under '/api/dashboard', so the full paths are:
 *
 *   GET /api/dashboard/stats
 *       → Overview stats for the user's dashboard (total scans, repos, findings)
 *
 *   GET /api/dashboard/repositories
 *       → All repos belonging to the authenticated user
 *
 *   GET /api/dashboard/repositories/:repositoryId
 *       → Single repo detail (with scan count)
 *
 *   GET /api/dashboard/repositories/:repositoryId/scans
 *       → Paginated scan history for a repo (supports ?page=&pageSize=)
 *
 *   GET /api/dashboard/scans/:scanResultId
 *       → Full scan detail: findings + remediations (the "drill-down" view)
 *
 * 💡 Why apply `authenticate` at the router level instead of per-route?
 * ────────────────────────────────────────────────────────────────────────
 * `router.use(authenticate)` registers the middleware once for ALL routes
 * in this router. This is safer than adding it to each route individually —
 * you can't accidentally forget it on a new route added later.
 * It follows the "secure by default" principle: every dashboard endpoint
 * requires authentication unless we EXPLICITLY choose to make it public.
 *
 * 💡 Why is the webhook router NOT protected by authenticate?
 * The webhook router (/api/webhooks) is called by GitHub's servers, not
 * by a human user with a JWT. It uses HMAC-SHA256 signature verification
 * instead (verifyGithubSignature middleware). Different callers → different
 * authentication mechanisms.
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import {
    getDashboardStatsHandler,
    getRepositoriesHandler,
    getRepositoryHandler,
    getScanResultsHandler,
    getScanResultDetailHandler,
} from '../controllers/dashboard.controller';

const dashboardRouter = Router();

// ── Apply JWT authentication to ALL routes in this router ─────────────────
// Any request to /api/dashboard/* without a valid Bearer token gets a 401.
dashboardRouter.use(authenticate);

// ── Route Definitions ──────────────────────────────────────────────────────

// Overview stats — powers the main dashboard summary cards
dashboardRouter.get('/stats', getDashboardStatsHandler);

// Repository list — powers the sidebar / repo selector
dashboardRouter.get('/repositories', getRepositoriesHandler);

// Single repository detail — powers the repo detail page header
dashboardRouter.get('/repositories/:repositoryId', getRepositoryHandler);

// Scan history for a repo — powers the scan list table
dashboardRouter.get('/repositories/:repositoryId/scans', getScanResultsHandler);

// Full scan detail — powers the individual scan report page
dashboardRouter.get('/scans/:scanResultId', getScanResultDetailHandler);

export { dashboardRouter };
