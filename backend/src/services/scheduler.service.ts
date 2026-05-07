import cron from 'node-cron';
import { prisma } from '../config/db';
import { getRepositoryContext } from './github.service';
import { addScanJob } from '../queues/scan.queue';
import { logger } from '../utils/logger';

export function initializeScheduler(): void {
    cron.schedule('0 0 * * *', async () => {
        logger.info('[Scheduler] Starting daily full-repo scan...');
        try {
            const repositories = await prisma.repository.findMany();
            logger.info(`[Scheduler] Found ${repositories.length} active repositories.`);

            for (const repo of repositories) {
                const logEntry = await prisma.scheduledScanLog.create({
                    data: {
                        repositoryId: repo.id,
                        status: 'STARTED',
                    },
                });

                try {
                    const [owner, name] = repo.fullName.split('/');
                    const context = await getRepositoryContext(owner, name);

                    await addScanJob({
                        installationId: context.installationId,
                        repositoryFullName: repo.fullName,
                        pullRequestNumber: 0,
                        headSha: context.headSha,
                        baseRef: context.defaultBranch,
                    });

                    await prisma.scheduledScanLog.update({
                        where: { id: logEntry.id },
                        data: { status: 'COMPLETED', completedAt: new Date() },
                    });

                    logger.info(`[Scheduler] Enqueued full scan for ${repo.fullName}`);
                } catch (error) {
                    await prisma.scheduledScanLog.update({
                        where: { id: logEntry.id },
                        data: { status: 'FAILED', completedAt: new Date() },
                    });
                    logger.error(`[Scheduler] Failed to enqueue scan for ${repo.fullName}`, { error });
                }
            }
            logger.info('[Scheduler] Daily full-repo scan enqueueing complete.');
        } catch (error) {
            logger.error('[Scheduler] Failed to fetch repositories for daily scan', { error });
        }
    });

    logger.info('[Scheduler] Cron jobs initialized. Full-repo scan scheduled daily at 00:00.');
}
