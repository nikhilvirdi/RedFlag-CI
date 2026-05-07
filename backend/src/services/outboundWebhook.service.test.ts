import { createOutboundWebhook, listOutboundWebhooks, deleteOutboundWebhook } from './outboundWebhook.service';

jest.mock('crypto', () => ({
    randomBytes: jest.fn(() => ({ toString: () => 'deadbeef' })),
    createHmac: jest.fn(() => ({ update: jest.fn().mockReturnThis(), digest: jest.fn(() => 'sig') })),
}));

jest.mock('../config/db', () => ({
    prisma: {
        outboundWebhook: {
            create: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            delete: jest.fn(),
        },
        repository: {
            findFirst: jest.fn(),
        },
    },
}));

import { prisma } from '../config/db';

const mockCreate = prisma.outboundWebhook.create as jest.Mock;
const mockFindMany = prisma.outboundWebhook.findMany as jest.Mock;
const mockFindFirst = prisma.outboundWebhook.findFirst as jest.Mock;
const mockDelete = prisma.outboundWebhook.delete as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('outboundWebhook.service', () => {
    describe('createOutboundWebhook', () => {
        it('creates a webhook with a generated secret', async () => {
            mockCreate.mockResolvedValue({ id: 'wh-1', url: 'https://example.com', events: ['scan.completed'] });

            const result = await createOutboundWebhook('user-1', 'https://example.com', ['scan.completed']);

            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ userId: 'user-1', url: 'https://example.com' }),
            }));
            expect(result.id).toBe('wh-1');
        });
    });

    describe('listOutboundWebhooks', () => {
        it('returns webhooks for a user without secrets', async () => {
            mockFindMany.mockResolvedValue([{ id: 'wh-1', url: 'https://example.com', events: ['scan.completed'], enabled: true }]);

            const result = await listOutboundWebhooks('user-1');

            expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
            expect(result).toHaveLength(1);
        });
    });

    describe('deleteOutboundWebhook', () => {
        it('throws if webhook not found for user', async () => {
            mockFindFirst.mockResolvedValue(null);

            await expect(deleteOutboundWebhook('wh-nonexistent', 'user-1')).rejects.toThrow('Webhook not found or access denied.');
            expect(mockDelete).not.toHaveBeenCalled();
        });

        it('deletes webhook when found and owned by user', async () => {
            mockFindFirst.mockResolvedValue({ id: 'wh-1', userId: 'user-1' });
            mockDelete.mockResolvedValue({ id: 'wh-1' });

            await deleteOutboundWebhook('wh-1', 'user-1');

            expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'wh-1' } });
        });
    });
});
