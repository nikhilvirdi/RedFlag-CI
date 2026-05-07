import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { SCAN_QUEUE_NAME, ScanJobData } from '../queues/scan.queue';
import { logger } from '../utils/logger';
import { runScanPipeline } from '../services/scan.service';
import { sendScanNotifications } from '../services/notification.service';
import { fireOutboundWebhooks } from '../services/outboundWebhook.service';
import { recordAuditEvent } from '../services/audit.service';
import { prisma } from '../config/db';

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

scanWorker.on('completed', async (job) => {
    logger.info(`Job [${job.id}] completed successfully.`);

    try {
        const repo = await prisma.repository.findFirst({
            where: { fullName: job.data.repositoryFullName },
            select: { id: true }
        });

        if (!repo) return;

        const latestScan = await prisma.scanResult.findFirst({
            where: { repositoryId: repo.id, commitSha: job.data.headSha, status: 'COMPLETED' },
            include: { riskScore: true, _count: { select: { findings: true } } }
        });

        if (!latestScan || !latestScan.riskScore) return;

        const payload = {
            repositoryFullName: job.data.repositoryFullName,
            repositoryId: repo.id,
            commitSha: job.data.headSha,
            pullRequestNumber: job.data.pullRequestNumber,
            riskScore: latestScan.riskScore.totalScore,
            riskClassification: latestScan.riskScore.classification,
            findingsCount: latestScan._count.findings,
            summary: `Score: ${latestScan.riskScore.totalScore}/100, ${latestScan._count.findings} finding(s)`,
        };

        await sendScanNotifications(payload);
        await fireOutboundWebhooks('scan.completed', payload);
        await recordAuditEvent({
            action: 'scan.completed',
            entity: 'ScanResult',
            entityId: latestScan.id,
            metadata: { repositoryFullName: job.data.repositoryFullName, riskScore: latestScan.riskScore.totalScore },
        });
    } catch (postScanError) {
        logger.warn(`[ScanWorker] Post-scan hooks failed: ${postScanError}`);
    }
});
scanWorker.on('failed', (job, err) => {
    logger.error(`Job [${job?.id}] failed after all retry attempts. Error: ${err.message}`);
});
scanWorker.on('error', (err) => {
    logger.error('Worker encountered an unexpected error:', err);
});
logger.info('Scan Worker is online and listening for jobs.');