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

export async function getAiImpactForRepository(repositoryId: string, days: number = 30) {
    logger.info(`[DashboardService] Fetching AI impact for repo: ${repositoryId}, days: ${days}`);

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
        include: {
            findings: true,
        },
        orderBy: { createdAt: 'asc' },
    });

    const AI_FINGERPRINT_CATEGORIES = [
        'Disabled Authentication (TODO)',
        'Wildcard CORS Configuration',
        'Wildcard CORS Header',
        'Debug Mode Enabled',
        'Disabled CSRF Protection',
        'Disabled TLS Verification',
        'Insecure Bind Address',
        'prompt_injection',
        'Hallucinated Package',
        'AI Code Fingerprint'
    ];

    let totalFindings = 0;
    let aiFingerprintedCount = 0;
    const findingsByAnalyzer: Record<string, number> = {};
    const trend: { date: Date; total: number; aiFingerprinted: number }[] = [];

    for (const scan of scanResults) {
        let scanTotal = 0;
        let scanAi = 0;

        for (const finding of scan.findings) {
            totalFindings++;
            scanTotal++;

            findingsByAnalyzer[finding.category] = (findingsByAnalyzer[finding.category] || 0) + 1;

            if (AI_FINGERPRINT_CATEGORIES.includes(finding.category) || finding.category.toLowerCase().includes('ai')) {
                aiFingerprintedCount++;
                scanAi++;
            }
        }

        trend.push({
            date: scan.createdAt,
            total: scanTotal,
            aiFingerprinted: scanAi,
        });
    }

    const aiPercentage = totalFindings > 0 ? (aiFingerprintedCount / totalFindings) * 100 : 0;

    return {
        totalFindings,
        findingsByAnalyzer,
        aiFingerprintedCount,
        aiPercentage,
        trend,
    };
}

export async function getSecurityDebtForRepository(repositoryId: string) {
    logger.info(`[DashboardService] Fetching security debt for repo: ${repositoryId}`);

    const scans = await prisma.scanResult.findMany({
        where: { repositoryId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        include: { findings: true },
    });

    if (scans.length < 2) return [];

    const latestScan = scans[0];
    const previousScans = scans.slice(1);

    const persistentFindings = [];

    for (const finding of latestScan.findings) {
        let occurrenceCount = 1;
        let firstSeenAt = latestScan.createdAt;

        for (const scan of previousScans) {
            const match = scan.findings.find(f => 
                f.category === finding.category && 
                f.file === finding.file && 
                f.codeSnippet === finding.codeSnippet
            );

            if (match) {
                occurrenceCount++;
                firstSeenAt = scan.createdAt;
            } else {
                break;
            }
        }

        if (occurrenceCount > 1) {
            persistentFindings.push({
                category: finding.category,
                file: finding.file,
                severity: finding.severity,
                occurrenceCount,
                firstSeenAt,
                codeSnippet: finding.codeSnippet,
            });
        }
    }

    persistentFindings.sort((a, b) => b.occurrenceCount - a.occurrenceCount);

    return persistentFindings;
}
