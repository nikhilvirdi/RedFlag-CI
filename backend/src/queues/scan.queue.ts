import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';

// QUEUE NAME CONSTANT
// Defining the queue name as a constant prevents typos from silently creating
// a second, disconnected queue. The Worker must use this exact same string.
export const SCAN_QUEUE_NAME = 'scan-queue';

// SCAN QUEUE (PRODUCER SIDE)
// This Queue object is the "intake desk". It only adds jobs.
// The actual processing is handled separately by the Worker.
export const scanQueue = new Queue(SCAN_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
        // Production Practice: Automatic Retry with Exponential Backoff
        // If the Python scan worker crashes mid-job (e.g., out of memory),
        // BullMQ will automatically re-attempt the job up to 3 times.
        // The delay doubles each attempt (1s, 2s, 4s) to avoid hammering a failing system.
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        // Production Practice: Auto-cleanup
        // After a job succeeds, keep it in Redis for 24 hours for debugging, then purge it.
        // Failed jobs are kept for 7 days to allow post-mortem investigation.
        removeOnComplete: { age: 3600 * 24 },
        removeOnFail: { age: 3600 * 24 * 7 },
    },
});

logger.info(`BullMQ Queue initialized: [${SCAN_QUEUE_NAME}]`);

// SCAN JOB DATA TYPE
// Strict TypeScript interface for what every job in this queue must contain.
// This prevents a controller from accidentally sending malformed data to the worker.
export interface ScanJobData {
    installationId: number;
    repositoryFullName: string;  // e.g., "nikhilvirdi/RedFlag-CI"
    pullRequestNumber: number;
    headSha: string;             // The exact commit SHA to scan
    baseRef: string;             // The target branch (e.g., "main")
}

// ADD JOB TO QUEUE
// This is the function the controller calls. It wraps the BullMQ add() call
// and provides structured logging so we can trace every job entering the system.
export async function addScanJob(data: ScanJobData): Promise<void> {
    const job = await scanQueue.add('scan-pr', data, {
        // Job ID is deterministic: same PR + same commit = same ID.
        // This prevents duplicate scans if GitHub fires the webhook twice (which it sometimes does).
        jobId: `${data.repositoryFullName}-pr-${data.pullRequestNumber}-${data.headSha}`,
    });
    logger.info(`Scan job enqueued. [Job ID: ${job.id}] [Repo: ${data.repositoryFullName}] [PR #${data.pullRequestNumber}]`);
}
