import { Request, Response, NextFunction } from 'express';
import { createOutboundWebhook, listOutboundWebhooks, deleteOutboundWebhook } from '../services/outboundWebhook.service';
import { recordAuditEvent } from '../services/audit.service';

export async function createWebhookHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { url, events } = req.body;

        if (!url || !events || !Array.isArray(events) || events.length === 0) {
            res.status(400).json({ error: 'url and events[] are required.' });
            return;
        }

        const validEvents = ['scan.completed'];
        for (const event of events) {
            if (!validEvents.includes(event)) {
                res.status(400).json({ error: `Invalid event: ${event}. Valid events: ${validEvents.join(', ')}` });
                return;
            }
        }

        const webhook = await createOutboundWebhook(userId, url, events);

        await recordAuditEvent({
            userId,
            action: 'webhook.created',
            entity: 'OutboundWebhook',
            entityId: webhook.id,
            metadata: { url, events },
        });

        res.status(201).json({ webhook: { id: webhook.id, url: webhook.url, events: webhook.events, secret: webhook.secret } });
    } catch (error) {
        next(error);
    }
}

export async function listWebhooksHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const webhooks = await listOutboundWebhooks(userId);
        res.status(200).json({ webhooks });
    } catch (error) {
        next(error);
    }
}

export async function deleteWebhookHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ error: 'Webhook id is required.' });
            return;
        }

        await deleteOutboundWebhook(id, userId);

        await recordAuditEvent({
            userId,
            action: 'webhook.deleted',
            entity: 'OutboundWebhook',
            entityId: id,
        });

        res.status(200).json({ message: 'Webhook deleted.' });
    } catch (error) {
        next(error);
    }
}
