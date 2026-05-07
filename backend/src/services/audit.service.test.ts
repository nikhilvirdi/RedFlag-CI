jest.mock('../config/db', () => ({
    prisma: {
        auditLog: {
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
    },
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { recordAuditEvent, getAuditLogs } from './audit.service';
import { prisma } from '../config/db';

const mockCreate = prisma.auditLog.create as jest.Mock;
const mockFindMany = prisma.auditLog.findMany as jest.Mock;
const mockCount = prisma.auditLog.count as jest.Mock;

describe('audit.service', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('recordAuditEvent', () => {
        it('calls prisma.auditLog.create with the entry', async () => {
            mockCreate.mockResolvedValue({});
            const entry = { action: 'scan.completed', entity: 'ScanResult', entityId: '123' };

            await recordAuditEvent(entry);

            expect(mockCreate).toHaveBeenCalledWith({ data: entry });
        });

        it('does not throw when prisma.create fails', async () => {
            mockCreate.mockRejectedValue(new Error('DB down'));

            await expect(
                recordAuditEvent({ action: 'test', entity: 'Test' })
            ).resolves.toBeUndefined();
        });
    });

    describe('getAuditLogs', () => {
        it('returns paginated audit logs for a user', async () => {
            const mockLogs = [{ id: '1', action: 'scan.completed' }];
            mockFindMany.mockResolvedValue(mockLogs);
            mockCount.mockResolvedValue(1);

            const result = await getAuditLogs('user-1', 1, 25);

            expect(result.data).toEqual(mockLogs);
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.totalCount).toBe(1);
            expect(result.pagination.totalPages).toBe(1);
        });

        it('filters by action when provided', async () => {
            mockFindMany.mockResolvedValue([]);
            mockCount.mockResolvedValue(0);

            await getAuditLogs('user-1', 1, 25, 'scan.completed');

            expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1', action: 'scan.completed' },
                })
            );
        });

        it('computes correct skip for page 2', async () => {
            mockFindMany.mockResolvedValue([]);
            mockCount.mockResolvedValue(30);

            await getAuditLogs('user-1', 2, 25);

            expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({ skip: 25 })
            );
        });
    });
});
