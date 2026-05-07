import { sendScanNotifications, configureNotification, getNotificationConfigs } from './notification.service';

jest.mock('../config/db', () => ({
    prisma: {
        notificationConfig: {
            findMany: jest.fn(),
            upsert: jest.fn(),
        },
    },
}));

global.fetch = jest.fn();

import { prisma } from '../config/db';

const mockFindMany = prisma.notificationConfig.findMany as jest.Mock;
const mockUpsert = prisma.notificationConfig.upsert as jest.Mock;
const mockFetch = global.fetch as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('notification.service', () => {
    describe('sendScanNotifications', () => {
        it('does nothing when no configs are found', async () => {
            mockFindMany.mockResolvedValue([]);

            await sendScanNotifications({
                repositoryFullName: 'org/repo',
                repositoryId: 'repo-1',
                commitSha: 'abc123',
                pullRequestNumber: 1,
                riskScore: 50,
                riskClassification: 'medium',
                findingsCount: 3,
                summary: 'test',
            });

            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('calls fetch for each enabled config', async () => {
            mockFindMany.mockResolvedValue([
                { id: 'cfg-1', platform: 'SLACK', webhookUrl: 'https://hooks.slack.com/x', enabled: true },
            ]);
            mockFetch.mockResolvedValue({ ok: true });

            await sendScanNotifications({
                repositoryFullName: 'org/repo',
                repositoryId: 'repo-1',
                commitSha: 'abc123',
                pullRequestNumber: 1,
                riskScore: 80,
                riskClassification: 'high',
                findingsCount: 5,
                summary: 'test',
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith('https://hooks.slack.com/x', expect.objectContaining({ method: 'POST' }));
        });
    });

    describe('configureNotification', () => {
        it('calls prisma upsert with correct args', async () => {
            mockUpsert.mockResolvedValue({ id: 'cfg-1', platform: 'DISCORD' });

            const result = await configureNotification('repo-1', 'DISCORD', 'https://discord.com/x');

            expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { repositoryId_platform: { repositoryId: 'repo-1', platform: 'DISCORD' } },
            }));
            expect(result.platform).toBe('DISCORD');
        });
    });

    describe('getNotificationConfigs', () => {
        it('returns all configs for a repository', async () => {
            mockFindMany.mockResolvedValue([{ id: 'cfg-1', platform: 'SLACK' }]);

            const result = await getNotificationConfigs('repo-1');

            expect(result).toHaveLength(1);
            expect(result[0].platform).toBe('SLACK');
        });
    });
});
