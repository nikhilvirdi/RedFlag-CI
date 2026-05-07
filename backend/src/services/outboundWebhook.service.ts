import crypto from 'crypto';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';

interface WebhookPayload {
    event: string;
    repositoryFullName: string;
    repositoryId: string;
    commitSha: string;
    pullRequestNumber: number;
    riskScore: number;
    riskClassification: string;
    findingsCount: number;
    summary: string;
    timestamp: string;
}

export async function createOutboundWebhook(
    userId: string,
    url: string,
    events: string[]
) {
    const secret = crypto.randomBytes(32).toString('hex');
    return prisma.outboundWebhook.create({
        data: { userId, url, secret, events }
    });
}

export async function listOutboundWebhooks(userId: string) {
    return prisma.outboundWebhook.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            url: true,
            events: true,
            enabled: true,
            createdAt: true,
            updatedAt: true,
        }
    });
}

export async function deleteOutboundWebhook(webhookId: string, userId: string) {
    const webhook = await prisma.outboundWebhook.findFirst({
        where: { id: webhookId, userId }
    });

    if (!webhook) {
        throw new Error('Webhook not found or access denied.');
    }

    await prisma.outboundWebhook.delete({ where: { id: webhookId } });
}

export async function fireOutboundWebhooks(
    event: string,
    data: Omit<WebhookPayload, 'event' | 'timestamp'>
): Promise<void> {
    const repo = await prisma.repository.findFirst({
        where: { id: data.repositoryId },
        select: { userId: true }
    });

    if (!repo) return;

    const webhooks = await prisma.outboundWebhook.findMany({
        where: {
            userId: repo.userId,
            enabled: true,
            events: { has: event }
        }
    });

    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
        event,
        ...data,
        timestamp: new Date().toISOString()
    };

    const body = JSON.stringify(payload);

    const results = await Promise.allSettled(
        webhooks.map(async (webhook) => {
            const signature = crypto
                .createHmac('sha256', webhook.secret)
                .update(body)
                .digest('hex');

            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-RedFlag-Signature': `sha256=${signature}`,
                    'X-RedFlag-Event': event,
                },
                body,
            });

            if (!response.ok) {
                throw new Error(`Outbound webhook ${webhook.id} returned ${response.status}`);
            }

            logger.info(`[OutboundWebhook] Delivered ${event} to ${webhook.url}`);
        })
    );

    for (const result of results) {
        if (result.status === 'rejected') {
            logger.warn(`[OutboundWebhook] Delivery failed: ${result.reason}`);
        }
    }
}
