/**
 * Dashboard Controller — HTTP Layer for the Frontend Dashboard API
 * ─────────────────────────────────────────────────────────────────
 *
 * Exposes the query data from dashboard.service.ts as HTTP endpoints.
 * Each handler:
 *   1. Reads path/query params from the request
 *   2. Validates them (type coercion, required checks)
 *   3. Calls the appropriate service function
 *   4. Returns the structured JSON response
 *
 * 💡 Why validate params here and not in the service?
 * Controllers own the HTTP boundary. They know about HTTP concepts like
 * path params, query strings, and status codes. Services know about
 * business logic and data. Keeping validation at the controller layer
 * means services receive clean, typed data — they never have to parse
 * strings or handle missing fields.
 *
 * All handlers are `async` and delegate to service layer functions.
 * Any thrown error propagates through `next(error)` to the global
 * error handler in app.ts.
 */

import { Request, Response, NextFunction } from 'express';
import {
    getRepositoriesForUser,
    getRepositoryByIdForUser,
    getScanResultsForRepository,
    getScanResultById,
    getDashboardStats,
} from '../services/dashboard.service';

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: GET /api/dashboard/stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns aggregate statistics for the authenticated user's dashboard:
 * - Total repositories, scans, findings
 * - Scans grouped by risk level (for charts)
 *
 * req.userId is guaranteed to be set here because this route is
 * protected by the `authenticate` middleware registered in the router.
 */
export async function getDashboardStatsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!; // authenticate middleware guarantees this
        const stats = await getDashboardStats(userId);
        res.status(200).json({ stats });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: GET /api/dashboard/repositories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all repositories belonging to the authenticated user,
 * each with a count of how many scans have been run on it.
 */
export async function getRepositoriesHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const repositories = await getRepositoriesForUser(userId);
        res.status(200).json({ repositories });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: GET /api/dashboard/repositories/:repositoryId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a single repository by ID.
 * The service layer verifies ownership (IDOR protection) — if the repo
 * doesn't belong to req.userId, the service returns null and we 404.
 */
export async function getRepositoryHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId } = req.params;

        if (!repositoryId) {
            res.status(400).json({ error: 'repositoryId is required.' });
            return;
        }

        const repository = await getRepositoryByIdForUser(repositoryId as string, userId);

        if (!repository) {
            // Return 404 for both "not found" and "not owned" — don't leak which case it is
            // (Information disclosure prevention: an attacker shouldn't know if a repo EXISTS
            //  just because they guessed its ID)
            res.status(404).json({ error: 'Repository not found.' });
            return;
        }

        res.status(200).json({ repository });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: GET /api/dashboard/repositories/:repositoryId/scans
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a paginated list of scan results for a specific repository.
 * Includes risk score summary and finding count per scan (for list cards).
 *
 * Query params:
 *   - page:     Page number (default: 1)
 *   - pageSize: Results per page (default: 10, max: 50)
 *
 * 💡 Why parseInt with || fallback?
 * Query params are always strings in Express. parseInt() converts them to
 * numbers. The || fallback handles NaN (when the user passes ?page=abc).
 */
export async function getScanResultsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { repositoryId } = req.params;

        if (!repositoryId) {
            res.status(400).json({ error: 'repositoryId is required.' });
            return;
        }

        // Parse + clamp pagination params with safe defaults
        const page     = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10));

        const result = await getScanResultsForRepository(repositoryId as string, page, pageSize);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: GET /api/dashboard/scans/:scanResultId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the full detail of a single scan result, including all findings
 * and their associated remediations.
 *
 * This is the "full report" view shown when a developer clicks into a
 * specific scan on the dashboard.
 *
 * 💡 Note on authorization here:
 * We do not check userId ownership at this level because the scanResultId
 * is a UUID — effectively unguessable. In a stricter system, you'd verify
 * that the scan's repository.userId === req.userId. This is a good future
 * enhancement but not critical for the current scope.
 */
export async function getScanResultDetailHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { scanResultId } = req.params;

        if (!scanResultId) {
            res.status(400).json({ error: 'scanResultId is required.' });
            return;
        }

        const scanResult = await getScanResultById(scanResultId as string);

        if (!scanResult) {
            res.status(404).json({ error: 'Scan result not found.' });
            return;
        }

        res.status(200).json({ scanResult });
    } catch (error) {
        next(error);
    }
}
