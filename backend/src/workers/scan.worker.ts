import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { SCAN_QUEUE_NAME, ScanJobData } from '../queues/scan.queue';
import { logger } from '../utils/logger';
import { runScanPipeline } from '../services/scan.service';

// SCAN WORKER (CONSUMER SIDE)
// The Worker is the "factory floor". It pulls jobs off the queue one by one
// and executes the full scan pipeline via scan.service.ts.
//
// 💡 Why is the worker so thin?
// The worker's ONLY job is to receive a job from BullMQ and delegate it.
// All business logic (fetching diffs, running Python, posting comments) lives
// in scan.service.ts. This makes the worker trivially testable and replaceable.

async function processScanJob(job: Job<ScanJobData>): Promise<void> {
    logger.info(`Worker picked up job [${job.id}] — Repo: ${job.data.repositoryFullName}, PR #${job.data.pullRequestNumber}`);

    // Delegate entirely to the scan service orchestrator.
    // If runScanPipeline() throws, BullMQ catches the rejection and
    // automatically retries the job with exponential backoff (configured in scan.queue.ts).
    await runScanPipeline(job.data);
}

// WORKER INSTANCE
// concurrency: 3 means this worker processes up to 3 jobs simultaneously.
// For CPU-bound Python scans, this number should be tuned carefully.
export const scanWorker = new Worker<ScanJobData>(
    SCAN_QUEUE_NAME,
    processScanJob,
    {
        connection: redisConnection,
        concurrency: 3,
    }
);
// WORKER EVENT HANDLERS
// These hooks provide full operational visibility into the queue lifecycle.
scanWorker.on('completed', (job) => {
    logger.info(`Job [${job.id}] completed successfully.`);
});
scanWorker.on('failed', (job, err) => {
    logger.error(`Job [${job?.id}] failed after all retry attempts. Error: ${err.message}`);
});
scanWorker.on('error', (err) => {
    logger.error('Worker encountered an unexpected error:', err);
});
logger.info('Scan Worker is online and listening for jobs.');