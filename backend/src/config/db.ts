import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
    globalThis.prisma ??
    new PrismaClient({
        log: [
            { level: 'error', emit: 'event' },
            { level: 'warn', emit: 'event' },
        ],
    });

if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}

// @ts-expect-error Prisma strictly checks event names against generic pool types
prisma.$on('error', (e: { message: string; timestamp: Date }) => {
    logger.error(`[Prisma Error] ${e.message}`, { timestamp: e.timestamp });
});

// @ts-expect-error
prisma.$on('warn', (e: { message: string; timestamp: Date }) => {
    logger.warn(`[Prisma Warning] ${e.message}`, { timestamp: e.timestamp });
});

export async function connectDatabase(): Promise<void> {
    try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
        logger.info('[Database] PostgreSQL connected and healthy.');
    } catch (error) {
        logger.error('[Database] Failed to connect to PostgreSQL.', { error });
        throw error;
    }
}
