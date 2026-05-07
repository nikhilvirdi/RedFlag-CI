import { initializeScheduler } from './scheduler.service';

jest.mock('node-cron', () => ({
    schedule: jest.fn((expr: string, fn: () => Promise<void>) => {
        (global as any).__cronCallback = fn;
    }),
}));

jest.mock('../config/db', () => ({
    prisma: {
        repository: { findMany: jest.fn() },
        scheduledScanLog: {
            create: jest.fn(),
            update: jest.fn(),
        },
    },
}));

jest.mock('./github.service', () => ({
    getRepositoryContext: jest.fn(),
}));

jest.mock('../queues/scan.queue', () => ({
    addScanJob: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn() },
}));

import { prisma } from '../config/db';
import { getRepositoryContext } from './github.service';
import { addScanJob } from '../queues/scan.queue';

const mockFindMany = prisma.repository.findMany as jest.Mock;
const mockLogCreate = prisma.scheduledScanLog.create as jest.Mock;
const mockLogUpdate = prisma.scheduledScanLog.update as jest.Mock;
const mockGetContext = getRepositoryContext as jest.Mock;
const mockAddScanJob = addScanJob as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('scheduler.service', () => {
    it('creates a ScheduledScanLog entry and marks it COMPLETED on success', async () => {
        initializeScheduler();

        mockFindMany.mockResolvedValue([{ id: 'repo-1', fullName: 'org/repo' }]);
        mockLogCreate.mockResolvedValue({ id: 'log-1' });
        mockGetContext.mockResolvedValue({ installationId: 42, headSha: 'abc', defaultBranch: 'main' });
        mockAddScanJob.mockResolvedValue(undefined);
        mockLogUpdate.mockResolvedValue({});

        await (global as any).__cronCallback();

        expect(mockLogCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: { repositoryId: 'repo-1', status: 'STARTED' },
        }));
        expect(mockLogUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'log-1' },
            data: expect.objectContaining({ status: 'COMPLETED' }),
        }));
    });

    it('marks ScheduledScanLog as FAILED when getRepositoryContext throws', async () => {
        initializeScheduler();

        mockFindMany.mockResolvedValue([{ id: 'repo-2', fullName: 'org/other' }]);
        mockLogCreate.mockResolvedValue({ id: 'log-2' });
        mockGetContext.mockRejectedValue(new Error('GitHub API error'));
        mockLogUpdate.mockResolvedValue({});

        await (global as any).__cronCallback();

        expect(mockLogUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'log-2' },
            data: expect.objectContaining({ status: 'FAILED' }),
        }));
    });
});
