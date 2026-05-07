import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';

const CLAUDE_CALLS_KEY = 'claude:calls:count';
const CLAUDE_TOKENS_KEY = 'claude:tokens:count';
const CLAUDE_CIRCUIT_KEY = 'claude:circuit:open';

const MAX_CALLS_PER_HOUR = 60;
const MAX_TOKENS_PER_HOUR = 500000;
const CIRCUIT_OPEN_DURATION_SECONDS = 300;
const WINDOW_SECONDS = 3600;

export async function canCallClaude(): Promise<{ allowed: boolean; reason?: string }> {
    const circuitOpen = await redisConnection.get(CLAUDE_CIRCUIT_KEY);
    if (circuitOpen) {
        return { allowed: false, reason: 'Circuit breaker is open. Claude API temporarily disabled.' };
    }

    const calls = parseInt(await redisConnection.get(CLAUDE_CALLS_KEY) || '0', 10);
    if (calls >= MAX_CALLS_PER_HOUR) {
        return { allowed: false, reason: `Hourly call limit reached (${MAX_CALLS_PER_HOUR}).` };
    }

    const tokens = parseInt(await redisConnection.get(CLAUDE_TOKENS_KEY) || '0', 10);
    if (tokens >= MAX_TOKENS_PER_HOUR) {
        return { allowed: false, reason: `Hourly token limit reached (${MAX_TOKENS_PER_HOUR}).` };
    }

    return { allowed: true };
}

export async function recordClaudeUsage(tokensUsed: number): Promise<void> {
    const pipeline = redisConnection.pipeline();

    const callsExist = await redisConnection.exists(CLAUDE_CALLS_KEY);
    pipeline.incr(CLAUDE_CALLS_KEY);
    if (!callsExist) {
        pipeline.expire(CLAUDE_CALLS_KEY, WINDOW_SECONDS);
    }

    const tokensExist = await redisConnection.exists(CLAUDE_TOKENS_KEY);
    pipeline.incrby(CLAUDE_TOKENS_KEY, tokensUsed);
    if (!tokensExist) {
        pipeline.expire(CLAUDE_TOKENS_KEY, WINDOW_SECONDS);
    }

    await pipeline.exec();
}

export async function tripCircuitBreaker(reason: string): Promise<void> {
    logger.warn(`[ClaudeRateLimit] Circuit breaker tripped: ${reason}`);
    await redisConnection.set(CLAUDE_CIRCUIT_KEY, reason, 'EX', CIRCUIT_OPEN_DURATION_SECONDS);
}

export async function getClaudeUsageStats(): Promise<{
    callsThisHour: number;
    tokensThisHour: number;
    maxCalls: number;
    maxTokens: number;
    circuitOpen: boolean;
}> {
    const [calls, tokens, circuit] = await Promise.all([
        redisConnection.get(CLAUDE_CALLS_KEY),
        redisConnection.get(CLAUDE_TOKENS_KEY),
        redisConnection.get(CLAUDE_CIRCUIT_KEY),
    ]);

    return {
        callsThisHour: parseInt(calls || '0', 10),
        tokensThisHour: parseInt(tokens || '0', 10),
        maxCalls: MAX_CALLS_PER_HOUR,
        maxTokens: MAX_TOKENS_PER_HOUR,
        circuitOpen: !!circuit,
    };
}
