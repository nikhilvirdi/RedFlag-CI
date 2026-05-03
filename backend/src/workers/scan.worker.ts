import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { SCAN_QUEUE_NAME, ScanJobData } from '../queues/scan.queue';
import { logger } from '../utils/logger';
import { runScanPipeline } from '../services/scan.service';

async function processScanJob(job: Job<ScanJobData>): Promise<void> {
    logger.info(`Worker picked up job [${job.id}] — Repo: ${job.data.repositoryFullName}, PR #${job.data.pullRequestNumber}`);
    await runScanPipeline(job.data);
}

export const scanWorker = new Worker<ScanJobData>(
    SCAN_QUEUE_NAME,
    processScanJob,
    {
        connection: redisConnection,
        concurrency: 3,
    }
);

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