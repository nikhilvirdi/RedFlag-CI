import IORedis from 'ioredis';
import { logger } from '../utils/logger';

// REDIS CONNECTION
// We create ONE shared IORedis connection instance used by both the Queue (producer)
// and the Worker (consumer). BullMQ requires ioredis — it does not use the standard 'redis' package.
//
// maxRetriesPerRequest: null is REQUIRED by BullMQ. Without it, BullMQ will throw
// an initialization error because it manages its own retry logic internally.
export const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
    maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => {
    logger.info('Redis connection established successfully.');
});

redisConnection.on('error', (err) => {
    logger.error('Redis connection error:', err);
});
