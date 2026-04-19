/**
 * Prisma Client Singleton
 * ────────────────────────
 *
 * This module exports a single, shared PrismaClient instance used throughout
 * the entire application.
 *
 * 💡 Why a singleton?
 * ─────────────────────
 * PrismaClient internally manages a connection pool — a set of pre-established
 * database connections that are reused across queries. If you create a new
 * PrismaClient() in every file that needs the database, you'd have:
 *   - N connection pools instead of 1 (one per imported file)
 *   - N × pool_size connections open to PostgreSQL simultaneously
 *   - PostgreSQL has a default max connection limit of 100 — this would exhaust it fast
 *
 * By exporting one shared instance, ALL database queries from ALL modules
 * share a single pool. This is the standard pattern for Prisma in production.
 *
 * 💡 Why the global trick in development?
 * ─────────────────────────────────────────
 * ts-node and nodemon (your hot-reload tool) re-execute all modules when a
 * file changes. Without the global trick, each reload would create a NEW
 * PrismaClient, meaning after 10 reloads, you'd have 10 connection pools.
 * The global trick stores the instance on Node's global object, which persists
 * across hot-reloads. In production (NODE_ENV === 'production'), we skip this
 * because the process only starts once.
 *
 * 💡 What is a connection pool?
 * ──────────────────────────────
 * Instead of opening and closing a database connection for every query (which
 * takes ~5–50ms due to TCP handshake + auth), a pool pre-opens several
 * connections and keeps them idle. When a query comes in, it borrows a
 * connection, runs the query, and returns it to the pool — total overhead: < 1ms.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// TYPE AUGMENTATION FOR GLOBAL
// ─────────────────────────────────────────────────────────────────────────────
// TypeScript's global type doesn't know about our custom 'prisma' property.
// We extend it here so TypeScript doesn't throw a type error on `global.prisma`.
//
// 💡 Why `globalThis` instead of just `global`?
// `globalThis` is the universally standardized global object that works in
// Node.js, browsers, and Web Workers. `global` is Node.js-only. Using
// globalThis makes the code portable.

declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRISMA CLIENT INSTANTIATION
// ─────────────────────────────────────────────────────────────────────────────

// In development: reuse the existing instance if it exists on global, otherwise create one.
// In production: always create a fresh instance (no hot-reload concern).
export const prisma: PrismaClient =
    globalThis.prisma ??
    new PrismaClient({
        log: [
            // In development, log all queries to help with debugging.
            // In production, only log errors (warns and infos are too verbose).
            { level: 'error',  emit: 'event' },
            { level: 'warn',   emit: 'event' },
        ],
    });

// Save to global only in non-production environments for hot-reload safety.
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED LOG BRIDGING
// ─────────────────────────────────────────────────────────────────────────────
// Prisma emits database-level events (errors, warnings). Here we bridge them
// into our Winston structured logger so all logs go to the same output format.
//
// 💡 Why 'emit: event' instead of 'emit: stdout'?
// emit: 'stdout' prints directly to console in Prisma's own format.
// emit: 'event'  fires a Node.js EventEmitter event we can subscribe to,
//               giving us full control over formatting via our Winston logger.

// @ts-expect-error Prisma strictly checks event names against generic pool types
prisma.$on('error', (e: { message: string; timestamp: Date }) => {
    logger.error(`[Prisma Error] ${e.message}`, { timestamp: e.timestamp });
});

// @ts-expect-error
prisma.$on('warn', (e: { message: string; timestamp: Date }) => {
    logger.warn(`[Prisma Warning] ${e.message}`, { timestamp: e.timestamp });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED DATABASE HEALTH CHECK + CONNECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies the database connection is alive.
 *
 * Called at application startup (src/index.ts) before accepting HTTP traffic.
 * If the database is unreachable, we fail fast — better to crash at startup
 * with a clear error than silently fail on the first incoming webhook.
 *
 * 💡 Why $connect() + $queryRaw SELECT 1?
 * $connect() establishes the initial connection pool. `SELECT 1` is the
 * lightest possible query — it doesn't touch any table, it just confirms
 * the connection is alive and the user has SELECT privileges.
 */
export async function connectDatabase(): Promise<void> {
    try {
        await prisma.$connect();
        // Verify the connection with the lightest possible SQL query.
        await prisma.$queryRaw`SELECT 1`;
        logger.info('✅ [Database] PostgreSQL connected and healthy.');
    } catch (error) {
        logger.error('❌ [Database] Failed to connect to PostgreSQL.', { error });
        // Re-throw so the application startup fails immediately with a clear message.
        // Without this, the server would start but all scan persistence would silently fail.
        throw error;
    }
}
