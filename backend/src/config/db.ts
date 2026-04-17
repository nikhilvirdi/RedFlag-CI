import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { env } from './env';

// Instantiate the globally available Prisma Client.
// We configure it to log warnings and errors natively so we don't miss hidden database bugs.
export const prisma = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

/**
 * 💡 Intuition: Why a connect function?
 * Prisma will "lazy load" the connection (it won't connect until your first query).
 * But in production, if the database is down, we want to know IMMEDIATELY when the server boots up, 
 * not 5 hours later when the first user tries to log in.
 * This function forces an immediate connection check.
 */
export async function connectDatabase() {
    try {
        await prisma.$connect();
        logger.info('🐘 Successfully established connection to PostgreSQL via Prisma');
    } catch (error) {
        logger.error('❌ FATAL: Failed to connect to the Prisma Database', error);
        process.exit(1); // Kill the server if the DB is unreachable
    }
}
