import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { addScanJob } from '../queues/scan.queue';
import { prisma } from '../config/db';

export const handleGithubWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const githubEvent = req.headers['x-github-event'];
        const payload = req.body;

        logger.info(`📥 Received Webhook Event: [${githubEvent}]`);

        res.status(200).json({ status: 'success', message: 'Webhook received and queued for processing.' });

        const PR_EVENTS = ['opened', 'synchronize', 'reopened'];
        if (githubEvent === 'pull_request' && PR_EVENTS.includes(payload.action)) {
            await addScanJob({
                installationId: payload.installation?.id,
                repositoryFullName: payload.repository.full_name,
                pullRequestNumber: payload.pull_request.number,
                headSha: payload.pull_request.head.sha,
                baseRef: payload.pull_request.base.ref,
            });
        } else if (githubEvent === 'installation' && payload.action === 'created') {
            const senderGithubId = String(payload.sender.id);
            const user = await prisma.user.findUnique({
                where: { githubId: senderGithubId }
            });
            
            if (user) {
                for (const repo of payload.repositories) {
                    await prisma.repository.upsert({
                        where: { githubRepoId: String(repo.id) },
                        update: {
                            name: repo.name,
                            fullName: repo.full_name,
                            url: `https://github.com/${repo.full_name}`,
                            isPrivate: repo.private,
                        },
                        create: {
                            githubRepoId: String(repo.id),
                            name: repo.name,
                            fullName: repo.full_name,
                            url: `https://github.com/${repo.full_name}`,
                            isPrivate: repo.private,
                            userId: user.id,
                        }
                    });
                }
                logger.info(`[WebhookController] Populated ${payload.repositories.length} repositories for user ${user.id}`);
            } else {
                logger.warn(`[WebhookController] Installation created by unknown user (githubId: ${senderGithubId})`);
            }
        } else if (githubEvent === 'installation_repositories') {
            const senderGithubId = String(payload.sender.id);
            const user = await prisma.user.findUnique({
                where: { githubId: senderGithubId }
            });
            
            if (user) {
                if (payload.action === 'added') {
                    for (const repo of payload.repositories_added) {
                        await prisma.repository.upsert({
                            where: { githubRepoId: String(repo.id) },
                            update: {
                                name: repo.name,
                                fullName: repo.full_name,
                                url: `https://github.com/${repo.full_name}`,
                                isPrivate: repo.private,
                            },
                            create: {
                                githubRepoId: String(repo.id),
                                name: repo.name,
                                fullName: repo.full_name,
                                url: `https://github.com/${repo.full_name}`,
                                isPrivate: repo.private,
                                userId: user.id,
                            }
                        });
                    }
                    logger.info(`[WebhookController] Added ${payload.repositories_added.length} repositories for user ${user.id}`);
                } else if (payload.action === 'removed') {
                    for (const repo of payload.repositories_removed) {
                        await prisma.repository.deleteMany({
                            where: { githubRepoId: String(repo.id) }
                        });
                    }
                    logger.info(`[WebhookController] Removed ${payload.repositories_removed.length} repositories for user ${user.id}`);
                }
            } else {
                logger.warn(`[WebhookController] installation_repositories event by unknown user (githubId: ${senderGithubId})`);
            }
        } else if (githubEvent === 'installation' && payload.action === 'deleted') {
            const senderGithubId = String(payload.sender.id);
            const user = await prisma.user.findUnique({
                where: { githubId: senderGithubId }
            });
            
            if (user) {
                const deleteResult = await prisma.repository.deleteMany({
                    where: { userId: user.id }
                });
                logger.info(`[WebhookController] Installation deleted. Removed ${deleteResult.count} repositories for user ${user.id}`);
            } else {
                logger.warn(`[WebhookController] Installation deleted by unknown user (githubId: ${senderGithubId})`);
            }
        } else {
            logger.debug(`Event [${githubEvent}:${payload.action}] — no scan required, ignoring.`);
        }

    } catch (error) {
        next(error);
    }
};
