import { redisConnection } from '../config/redis';

const OAUTH_STATE_PREFIX = 'oauth:state:';
const STATE_TTL_SECONDS = 600;

export async function storeOAuthState(state: string): Promise<void> {
    await redisConnection.set(
        `${OAUTH_STATE_PREFIX}${state}`,
        Date.now().toString(),
        'EX',
        STATE_TTL_SECONDS
    );
}

export async function validateAndConsumeOAuthState(state: string): Promise<boolean> {
    const result = await redisConnection.get(`${OAUTH_STATE_PREFIX}${state}`);
    if (!result) return false;

    await redisConnection.del(`${OAUTH_STATE_PREFIX}${state}`);
    return true;
}
