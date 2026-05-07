import { Request, Response, NextFunction } from 'express';
import { configureNotification, removeNotification, getNotificationConfigs } from '../services/notification.service';
import { getRepositoryByIdForUser } from '../services/dashboard.service';
import { recordAuditEvent } from '../services/audit.service';

export async function configureNotificationHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId } = req.params;
        const { platform, webhookUrl } = req.body;

        if (!repositoryId || !platform || !webhookUrl) {
            res.status(400).json({ error: 'repositoryId, platform, and webhookUrl are required.' });
            return;
        }

        if (!['SLACK', 'DISCORD'].includes(platform)) {
            res.status(400).json({ error: 'platform must be SLACK or DISCORD.' });
            return;
        }

        const repository = await getRepositoryByIdForUser(repositoryId, userId);
        if (!repository) {
            res.status(404).json({ error: 'Repository not found or access denied.' });
            return;
        }

        const config = await configureNotification(repositoryId, platform, webhookUrl);

        await recordAuditEvent({
            userId,
            action: 'notification.configured',
            entity: 'NotificationConfig',
            entityId: config.id,
            metadata: { platform, repositoryId },
        });

        res.status(200).json({ config });
    } catch (error) {
        next(error);
    }
}

export async function removeNotificationHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId } = req.params;
        const { platform } = req.body;

        if (!repositoryId || !platform) {
            res.status(400).json({ error: 'repositoryId and platform are required.' });
            return;
        }

        if (!['SLACK', 'DISCORD'].includes(platform)) {
            res.status(400).json({ error: 'platform must be SLACK or DISCORD.' });
            return;
        }

        const repository = await getRepositoryByIdForUser(repositoryId, userId);
        if (!repository) {
            res.status(404).json({ error: 'Repository not found or access denied.' });
            return;
        }

        await removeNotification(repositoryId, platform);

        await recordAuditEvent({
            userId,
            action: 'notification.removed',
            entity: 'NotificationConfig',
            metadata: { platform, repositoryId },
        });

        res.status(200).json({ message: 'Notification config removed.' });
    } catch (error) {
        next(error);
    }
}

export async function listNotificationConfigsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId } = req.params;

        if (!repositoryId) {
            res.status(400).json({ error: 'repositoryId is required.' });
            return;
        }

        const repository = await getRepositoryByIdForUser(repositoryId, userId);
        if (!repository) {
            res.status(404).json({ error: 'Repository not found or access denied.' });
            return;
        }

        const configs = await getNotificationConfigs(repositoryId);
        res.status(200).json({ configs });
    } catch (error) {
        next(error);
    }
}
