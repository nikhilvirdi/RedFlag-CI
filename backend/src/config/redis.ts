import IORedis from 'ioredis';
import { logger } from '../utils/logger';

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
