import { prisma } from '../config/db';
import { logger } from '../utils/logger';

interface ScanNotificationPayload {
    repositoryFullName: string;
    repositoryId: string;
    commitSha: string;
    pullRequestNumber: number;
    riskScore: number;
    riskClassification: string;
    findingsCount: number;
    summary: string;
}

function buildSlackPayload(data: ScanNotificationPayload) {
    const emoji = data.riskScore >= 70 ? ':red_circle:' : data.riskScore >= 40 ? ':large_yellow_circle:' : ':large_green_circle:';
    return {
        text: `${emoji} RedFlag CI Scan Complete`,
        blocks: [
            {
                type: 'header',
                text: { type: 'plain_text', text: `RedFlag CI — Scan Report` }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Repository:*\n${data.repositoryFullName}` },
                    { type: 'mrkdwn', text: `*PR:*\n${data.pullRequestNumber === 0 ? 'On-Demand' : `#${data.pullRequestNumber}`}` },
                    { type: 'mrkdwn', text: `*Risk Score:*\n${data.riskScore}/100` },
                    { type: 'mrkdwn', text: `*Classification:*\n${data.riskClassification.toUpperCase()}` },
                    { type: 'mrkdwn', text: `*Findings:*\n${data.findingsCount}` },
                    { type: 'mrkdwn', text: `*Commit:*\n${data.commitSha.slice(0, 7)}` }
                ]
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*Summary:* ${data.summary}` }
            }
        ]
    };
}

function buildDiscordPayload(data: ScanNotificationPayload) {
    const color = data.riskScore >= 70 ? 0xE74C3C : data.riskScore >= 40 ? 0xF39C12 : 0x2ECC71;
    return {
        embeds: [{
            title: 'RedFlag CI — Scan Report',
            color,
            fields: [
                { name: 'Repository', value: data.repositoryFullName, inline: true },
                { name: 'PR', value: data.pullRequestNumber === 0 ? 'On-Demand' : `#${data.pullRequestNumber}`, inline: true },
                { name: 'Risk Score', value: `${data.riskScore}/100`, inline: true },
                { name: 'Classification', value: data.riskClassification.toUpperCase(), inline: true },
                { name: 'Findings', value: `${data.findingsCount}`, inline: true },
                { name: 'Commit', value: data.commitSha.slice(0, 7), inline: true },
                { name: 'Summary', value: data.summary }
            ],
            timestamp: new Date().toISOString()
        }]
    };
}

export async function sendScanNotifications(data: ScanNotificationPayload): Promise<void> {
    const configs = await prisma.notificationConfig.findMany({
        where: { repositoryId: data.repositoryId, enabled: true }
    });

    if (configs.length === 0) return;

    const results = await Promise.allSettled(
        configs.map(async (config) => {
            const payload = config.platform === 'SLACK'
                ? buildSlackPayload(data)
                : buildDiscordPayload(data);

            const response = await fetch(config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`${config.platform} webhook returned ${response.status}`);
            }

            logger.info(`[NotificationService] ${config.platform} notification sent for ${data.repositoryFullName}`);
        })
    );

    for (const result of results) {
        if (result.status === 'rejected') {
            logger.warn(`[NotificationService] Failed to deliver notification: ${result.reason}`);
        }
    }
}

export async function configureNotification(
    repositoryId: string,
    platform: 'SLACK' | 'DISCORD',
    webhookUrl: string
) {
    return prisma.notificationConfig.upsert({
        where: { repositoryId_platform: { repositoryId, platform } },
        update: { webhookUrl, enabled: true },
        create: { repositoryId, platform, webhookUrl }
    });
}

export async function removeNotification(repositoryId: string, platform: 'SLACK' | 'DISCORD') {
    return prisma.notificationConfig.delete({
        where: { repositoryId_platform: { repositoryId, platform } }
    });
}

export async function getNotificationConfigs(repositoryId: string) {
    return prisma.notificationConfig.findMany({
        where: { repositoryId },
        orderBy: { createdAt: 'desc' }
    });
}
