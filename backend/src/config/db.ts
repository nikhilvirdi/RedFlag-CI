import { logger } from '../utils/logger';

// PRISMA STUB — Prisma v7 engine mismatch is being resolved separately.
// This stub allows Express, BullMQ, and Redis to boot and be tested independently.
// Replace with the real PrismaClient once the engine type issue is resolved.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = null;

export async function connectDatabase() {
    // Skipping database connection until Prisma engine is resolved.
    logger.warn('Database connection skipped — Prisma engine version mismatch (stub active).');
}

