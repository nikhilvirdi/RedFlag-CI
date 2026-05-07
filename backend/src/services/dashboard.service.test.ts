import { getDashboardStats, getRepositoriesForUser, getScanResultsForRepository } from './dashboard.service';

jest.mock('../config/db', () => ({
    prisma: {
        repository: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        scanResult: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        finding: {
            count: jest.fn(),
        },
        riskScore: {
            groupBy: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

import { prisma } from '../config/db';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

beforeEach(() => jest.clearAllMocks());

describe('dashboard.service', () => {
    describe('getRepositoriesForUser', () => {
        it('returns repositories for the given userId', async () => {
            const fakeRepos = [{ id: 'repo-1', userId: 'user-1', fullName: 'org/repo', createdAt: new Date(), _count: { scanResults: 3 } }];
            (mockPrisma.repository.findMany as jest.Mock).mockResolvedValue(fakeRepos);

            const result = await getRepositoriesForUser('user-1');

            expect(mockPrisma.repository.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('repo-1');
        });
    });

    describe('getScanResultsForRepository', () => {
        it('returns paginated scan results with correct metadata', async () => {
            const fakeScans = [{ id: 'scan-1', repositoryId: 'repo-1', createdAt: new Date() }];
            (mockPrisma.scanResult.findMany as jest.Mock).mockResolvedValue(fakeScans);
            (mockPrisma.scanResult.count as jest.Mock).mockResolvedValue(1);

            const result = await getScanResultsForRepository('repo-1', 1, 10);

            expect(result.data).toHaveLength(1);
            expect(result.pagination.totalCount).toBe(1);
            expect(result.pagination.totalPages).toBe(1);
        });
    });

    describe('getDashboardStats', () => {
        it('returns aggregate counts from transaction', async () => {
            (mockPrisma.repository.findMany as jest.Mock).mockResolvedValue([{ id: 'repo-1' }]);
            (mockPrisma.$transaction as jest.Mock).mockResolvedValue([2, 5, 12, []]);

            const result = await getDashboardStats('user-1');

            expect(result.totalRepos).toBe(2);
            expect(result.totalScans).toBe(5);
            expect(result.totalFindings).toBe(12);
        });
    });
});
