import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisConnection } from '../config/redis';

export const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args: string[]) => redisConnection.call(...args) as any,
    }),
    message: { error: 'Too many requests. Please try again later.' },
});

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args: string[]) => redisConnection.call(...args) as any,
        prefix: 'rl:auth:',
    }),
    message: { error: 'Too many authentication attempts. Please try again later.' },
});

export const webhookRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args: string[]) => redisConnection.call(...args) as any,
        prefix: 'rl:webhook:',
    }),
    message: { error: 'Webhook rate limit exceeded.' },
});

export const badgeRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args: string[]) => redisConnection.call(...args) as any,
        prefix: 'rl:badge:',
    }),
    message: { error: 'Badge rate limit exceeded.' },
});
