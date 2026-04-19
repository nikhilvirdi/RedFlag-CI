/**
 * Dashboard Service — Data Retrieval Layer
 * ─────────────────────────────────────────
 *
 * This service provides the query logic for the frontend dashboard.
 * It is the "read side" of the application — it never writes data.
 * All data was written by the scan pipeline (scan.service.ts) and the
 * auth flow (auth.service.ts). This service just fetches and shapes it.
 *
 * 💡 Why a separate service for dashboard queries?
 * ──────────────────────────────────────────────────
 * The scan pipeline writes data in the shape that's efficient for storage
 * (normalized Prisma models). The dashboard needs data in the shape that's
 * efficient for display (denormalized JSON responses). Keeping the
 * transformation logic here, not in controllers, maintains a clean boundary:
 *   Controller → handles HTTP (input/output)
 *   Service    → handles business logic (queries + shaping)
 *
 * 💡 What is "N+1 problem" and how does Prisma's `include` solve it?
 * ────────────────────────────────────────────────────────────────────
 * N+1 problem: If you fetch 10 scan results, then fetch findings for each
 * one separately, that's 1 + 10 = 11 SQL queries. For 100 results: 101 queries.
 * Prisma's `include` generates a single JOIN query (or a batched SELECT IN)
 * that fetches the parent and all children in ONE round-trip.
 * This is the difference between a 2ms response and a 200ms response.
 */

import { prisma } from '../config/db';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all repositories associated with a given user, ordered by most
 * recently created first. Includes a count of how many scans each repo has.
 *
 * 💡 Why `_count` instead of querying ScanResults separately?
 * `_count` is a Prisma aggregation that adds a computed count field to the
 * result in the SAME query. It avoids a second round-trip to the database
 * just to count related records.
 */
export async function getRepositoriesForUser(userId: string) {
    logger.info(`[DashboardService] Fetching repositories for user: ${userId}`);

    const repositories = await prisma.repository.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { scanResults: true }, // inline "number of scans" per repo
            },
        },
    });

    return repositories;
}

/**
 * Returns a single repository by its internal UUID and verifies that it
 * belongs to the requesting user (authorization check).
 *
 * 💡 Why check userId here and not in the middleware?
 * This is a "resource-level authorization" check — not just "is the user
 * logged in" (authentication) but "does this user OWN this resource"
 * (authorization). The auth middleware only verifies the JWT is valid.
 * We explicitly check ownership here to prevent IDOR attacks:
 * (Insecure Direct Object Reference — user A guessing user B's repo ID).
 */
export async function getRepositoryByIdForUser(repositoryId: string, userId: string) {
    logger.info(`[DashboardService] Fetching repository ${repositoryId} for user: ${userId}`);

    const repository = await prisma.repository.findFirst({
        where: {
            id: repositoryId,
            userId, // IDOR protection: ensures this repo belongs to the requesting user
        },
        include: {
            _count: {
                select: { scanResults: true },
            },
        },
    });

    return repository; // null if not found or not owned by user
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAN RESULT QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a paginated list of scan results for a specific repository.
 *
 * Includes the risk score summary but NOT the full findings list — that
 * would be too heavy for a list view. The heavy data is loaded separately
 * via getScanResultById() when the user clicks into a specific scan.
 *
 * 💡 What is cursor-based pagination vs. offset pagination?
 * ──────────────────────────────────────────────────────────
 * Offset: SELECT * FROM scans LIMIT 10 OFFSET 20
 *   - Simple, but slow for large tables (DB must scan and discard 20 rows)
 *   - Can show duplicate/missing rows if new data is inserted during pagination
 *
 * Cursor-based (what we use here via `skip` + `take` with `cursor`):
 *   - Uses the ID of the last seen record as a "bookmark"
 *   - Only scans from the bookmark forward — O(1) regardless of page depth
 *   - Stable: new data doesn't affect already-fetched pages
 *
 * For the dashboard, we use simple `skip`/`take` (offset) for now since the
 * expected volume per repo is low (< 1000 scans). This can be upgraded to
 * cursor-based later by adding a `cursor` parameter.
 */
export async function getScanResultsForRepository(
    repositoryId: string,
    page: number = 1,
    pageSize: number = 10
) {
    logger.info(`[DashboardService] Fetching scan results for repo: ${repositoryId}, page ${page}`);

    const skip = (page - 1) * pageSize;

    const [scanResults, totalCount] = await Promise.all([
        prisma.scanResult.findMany({
            where: { repositoryId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
            include: {
                riskScore: true, // include the score summary (small join)
                _count: {
                    select: { findings: true }, // include finding count for the list view
                },
            },
        }),
        // Run the COUNT query in parallel with the data query — saves one round-trip
        prisma.scanResult.count({ where: { repositoryId } }),
    ]);

    return {
        data: scanResults,
        pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
        },
    };
}

/**
 * Returns the full detail of a single scan result, including ALL findings
 * and their remediation data.
 *
 * This is the "drill-down" view — called when a developer clicks on a
 * specific scan in the dashboard to see the full vulnerability report.
 *
 * 💡 Why nested `include` (findings → remediation)?
 * Prisma's nested include generates an efficient query that fetches the scan,
 * its findings, and each finding's remediation in a single JOIN. Three tables,
 * one round-trip. Without this, you'd need three separate queries.
 */
export async function getScanResultById(scanResultId: string) {
    logger.info(`[DashboardService] Fetching full scan detail for: ${scanResultId}`);

    const scanResult = await prisma.scanResult.findUnique({
        where: { id: scanResultId },
        include: {
            riskScore: true,
            repository: {
                select: { fullName: true, url: true }, // minimal repo info for display
            },
            findings: {
                orderBy: [
                    // Sort by severity descending so critical findings appear first
                    { severity: 'asc' }, // CRITICAL < HIGH < MEDIUM < LOW alphabetically
                    { confidence: 'asc' },
                ],
                include: {
                    remediation: true, // each finding's fix / recommendation
                },
            },
        },
    });

    return scanResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns aggregate statistics for a user's dashboard overview:
 * - Total repositories
 * - Total scans run
 * - Total findings found
 * - Number of scans by risk classification (for the pie chart)
 *
 * 💡 Why $transaction for aggregates?
 * prisma.$transaction([query1, query2, ...]) runs all queries inside a single
 * database transaction and in a single network round-trip (using multiplexing).
 * This guarantees that all counts are consistent with each other — no race
 * condition where new scans are inserted between individual COUNT queries.
 */
export async function getDashboardStats(userId: string) {
    logger.info(`[DashboardService] Computing dashboard stats for user: ${userId}`);

    // Get the IDs of all repositories owned by this user (for sub-queries)
    const userRepos = await prisma.repository.findMany({
        where: { userId },
        select: { id: true },
    });
    const repoIds = userRepos.map((r) => r.id);

    const [
        totalRepos,
        totalScans,
        totalFindings,
        scansByRisk,
    ] = await prisma.$transaction([
        // Total repositories
        prisma.repository.count({ where: { userId } }),

        // Total scans across all user repos
        prisma.scanResult.count({
            where: { repositoryId: { in: repoIds } },
        }),

        // Total findings across all user scans
        prisma.finding.count({
            where: { scanResult: { repositoryId: { in: repoIds } } },
        }),

        // Scan count grouped by risk classification — powers the dashboard chart
        // 💡 Prisma doesn't have a built-in groupBy with filter across relations,
        // so we use a raw approach: count each level separately
        prisma.riskScore.groupBy({
            by: ['classification'],
            where: { scanResult: { repositoryId: { in: repoIds } } },
            _count: { classification: true },
        }),
    ]);

    return {
        totalRepos,
        totalScans,
        totalFindings,
        // Transform groupBy result into a clean { CRITICAL: 3, HIGH: 5, ... } map
        scansByRiskLevel: scansByRisk.reduce((acc, item) => {
            acc[item.classification] = item._count.classification;
            return acc;
        }, {} as Record<string, number>),
    };
}
