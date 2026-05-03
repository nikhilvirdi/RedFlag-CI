import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';

export const SCAN_QUEUE_NAME = 'scan-queue';

export const scanQueue = new Queue(SCAN_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: { age: 3600 * 24 },
        removeOnFail: { age: 3600 * 24 * 7 },
    },
});

logger.info(`BullMQ Queue initialized: [${SCAN_QUEUE_NAME}]`);

export interface ScanJobData {
    installationId: number;
    repositoryFullName: string;
    pullRequestNumber: number;
    headSha: string;
    baseRef: string;
}

export async function addScanJob(data: ScanJobData): Promise<void> {
    const job = await scanQueue.add('scan-pr', data, {
        jobId: `${data.repositoryFullName}-pr-${data.pullRequestNumber}-${data.headSha}`,
    });
    logger.info(`Scan job enqueued. [Job ID: ${job.id}] [Repo: ${data.repositoryFullName}] [PR #${data.pullRequestNumber}]`);
}
