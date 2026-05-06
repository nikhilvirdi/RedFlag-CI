import { prisma } from '../config/db';
import { logger } from '../utils/logger';

export async function getRepositoriesForUser(userId: string) {
    logger.info(`[DashboardService] Fetching repositories for user: ${userId}`);

    const repositories = await prisma.repository.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { scanResults: true },
            },
        },
    });

    return repositories;
}

export async function getRepositoryByIdForUser(repositoryId: string, userId: string) {
    logger.info(`[DashboardService] Fetching repository ${repositoryId} for user: ${userId}`);

    const repository = await prisma.repository.findFirst({
        where: {
            id: repositoryId,
            userId,
        },
        include: {
            _count: {
                select: { scanResults: true },
            },
        },
    });

    return repository;
}

export async function getScanResultsForRepository(
    repositoryId: string,
    page: number = 1,
    pageSize: number = 10
) {
    logger.info(`[DashboardService] Fetching scan results for repo: ${repositoryId}, page ${page}`);

    const skip = (page - 1) * pageSize;

    const [scanResults, totalCount] = await Promise.all([
        prisma.scanResult.findMany({
            where: { repositoryId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
            include: {
                riskScore: true,
                _count: {
                    select: { findings: true },
                },
            },
        }),
        prisma.scanResult.count({ where: { repositoryId } }),
    ]);

    return {
        data: scanResults,
        pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
        },
    };
}

export async function getScanResultById(scanResultId: string) {
    logger.info(`[DashboardService] Fetching full scan detail for: ${scanResultId}`);

    const scanResult = await prisma.scanResult.findUnique({
        where: { id: scanResultId },
        include: {
            riskScore: true,
            repository: {
                select: { fullName: true, url: true },
            },
            findings: {
                orderBy: [
                    { severity: 'asc' },
                    { confidence: 'asc' },
                ],
                include: {
                    remediation: true,
                },
            },
        },
    });

    return scanResult;
}

export async function getDashboardStats(userId: string) {
    logger.info(`[DashboardService] Computing dashboard stats for user: ${userId}`);

    const userRepos = await prisma.repository.findMany({
        where: { userId },
        select: { id: true },
    });
    const repoIds = userRepos.map((r) => r.id);

    const [
        totalRepos,
        totalScans,
        totalFindings,
        scansByRisk,
    ] = await prisma.$transaction([
        prisma.repository.count({ where: { userId } }),

        prisma.scanResult.count({
            where: { repositoryId: { in: repoIds } },
        }),

        prisma.finding.count({
            where: { scanResult: { repositoryId: { in: repoIds } } },
        }),

        prisma.riskScore.groupBy({
            by: ['classification'],
            where: { scanResult: { repositoryId: { in: repoIds } } },
            _count: { classification: true },
        }),
    ]);

    return {
        totalRepos,
        totalScans,
        totalFindings,
        scansByRiskLevel: scansByRisk.reduce((acc, item) => {
            acc[item.classification] = item._count.classification;
            return acc;
        }, {} as Record<string, number>),
    };
}

export async function getRiskTrendForRepository(repositoryId: string, days: number = 30) {
    logger.info(`[DashboardService] Fetching risk trend for repo: ${repositoryId}, days: ${days}`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const scanResults = await prisma.scanResult.findMany({
        where: {
            repositoryId,
            status: 'COMPLETED',
            createdAt: {
                gte: cutoffDate,
            },
        },
        orderBy: { createdAt: 'asc' },
        include: {
            riskScore: true,
        },
    });

    return scanResults.map(scan => ({
        date: scan.createdAt,
        riskScore: scan.riskScore?.totalScore ?? 0,
        classification: scan.riskScore?.classification ?? 'CLEAN',
    }));
}
