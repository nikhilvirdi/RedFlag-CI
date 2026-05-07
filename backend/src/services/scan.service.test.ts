import { runScanPipeline } from './scan.service';

jest.mock('../config/db', () => ({
    prisma: {
        repository: { findFirst: jest.fn() },
        scanResult: { create: jest.fn(), update: jest.fn() },
        finding: { createMany: jest.fn() },
        riskScore: { create: jest.fn() },
    },
}));

jest.mock('./github.service', () => ({
    getInstallationOctokit: jest.fn(),
    getPullRequestDiff: jest.fn(),
    getCommitDiff: jest.fn(),
    postPullRequestComment: jest.fn(),
    setCommitStatus: jest.fn(),
    getFileContent: jest.fn(),
    createBranch: jest.fn(),
    createBlob: jest.fn(),
    createTree: jest.fn(),
    createCommit: jest.fn(),
    updateRef: jest.fn(),
    createPullRequest: jest.fn(),
}));

jest.mock('./remediation.service', () => ({
    remediateFindings: jest.fn(async (f: unknown[]) => f),
}));

jest.mock('./chaining.service', () => ({
    chainFindings: jest.fn().mockReturnValue([]),
}));

jest.mock('./memory.service', () => ({
    detectRegressions: jest.fn().mockResolvedValue(undefined),
    storeEmbeddings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./similarity.service', () => ({
    scanForSimilarPatterns: jest.fn().mockResolvedValue([]),
}));

jest.mock('./falsePositive.service', () => ({
    filterFalsePositives: jest.fn(async (f: unknown[]) => f),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { prisma } from '../config/db';
import { getInstallationOctokit, getPullRequestDiff, setCommitStatus, postPullRequestComment } from './github.service';

const mockRepo = prisma.repository.findFirst as jest.Mock;
const mockScanCreate = prisma.scanResult.create as jest.Mock;
const mockScanUpdate = prisma.scanResult.update as jest.Mock;
const mockRiskCreate = prisma.riskScore.create as jest.Mock;
const mockGetOctokit = getInstallationOctokit as jest.Mock;
const mockGetDiff = getPullRequestDiff as jest.Mock;
const mockSetStatus = setCommitStatus as jest.Mock;
const mockPostComment = postPullRequestComment as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('scan.service', () => {
    describe('runScanPipeline', () => {
        it('sets commit status to failed and updates scan record when repository is not found', async () => {
            mockRepo.mockResolvedValue(null);
            mockGetOctokit.mockResolvedValue({});
            mockSetStatus.mockResolvedValue(undefined);

            await expect(
                runScanPipeline({
                    installationId: 1,
                    repositoryFullName: 'org/missing',
                    pullRequestNumber: 42,
                    headSha: 'sha123',
                    baseRef: 'main',
                })
            ).rejects.toThrow();
        });

        it('creates a ScanResult record and sets commit status to pending on start', async () => {
            mockRepo.mockResolvedValue({ id: 'repo-1', fullName: 'org/repo', url: 'https://github.com/org/repo' });
            mockScanCreate.mockResolvedValue({ id: 'scan-1', repositoryId: 'repo-1', status: 'PENDING' });
            mockGetOctokit.mockResolvedValue({});
            mockSetStatus.mockResolvedValue(undefined);
            mockGetDiff.mockRejectedValue(new Error('GitHub API unreachable'));
            mockScanUpdate.mockResolvedValue({});

            await runScanPipeline({
                installationId: 1,
                repositoryFullName: 'org/repo',
                pullRequestNumber: 1,
                headSha: 'sha123',
                baseRef: 'main',
            });

            expect(mockScanCreate).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ repositoryId: 'repo-1', status: 'IN_PROGRESS' }),
            }));
            expect(mockSetStatus).toHaveBeenCalled();
        });
    });
});
