import { prisma } from '../config/db';

export interface PostureScore {
    score: number;
    severityDistribution: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    regressionCount: number;
    trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
}

export async function calculatePostureScore(repositoryId: string): Promise<PostureScore> {
    const recentScans = await prisma.scanResult.findMany({
        where: { repositoryId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 2,
        include: { findings: true, riskScore: true }
    });

    if (recentScans.length === 0) {
        return {
            score: 100,
            severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
            regressionCount: 0,
            trend: 'insufficient_data'
        };
    }

    const latestScan = recentScans[0];
    
    const distribution = { critical: 0, high: 0, medium: 0, low: 0 };
    let regressionCount = 0;

    for (const f of latestScan.findings) {
        if (f.severity === 'CRITICAL') distribution.critical++;
        else if (f.severity === 'HIGH') distribution.high++;
        else if (f.severity === 'MEDIUM') distribution.medium++;
        else if (f.severity === 'LOW') distribution.low++;

        if (f.description.includes('[REGRESSION]')) {
            regressionCount++;
        }
    }

    let score = 100;
    score -= distribution.critical * 20;
    score -= distribution.high * 10;
    score -= distribution.medium * 5;
    score -= distribution.low * 2;
    score -= regressionCount * 5;

    score = Math.max(0, Math.min(100, score));

    let trend: 'improving' | 'stable' | 'declining' | 'insufficient_data' = 'insufficient_data';

    if (recentScans.length === 2) {
        const currentRisk = latestScan.riskScore?.totalScore ?? 0;
        const previousRisk = recentScans[1].riskScore?.totalScore ?? 0;
        
        if (currentRisk < previousRisk) trend = 'improving';
        else if (currentRisk > previousRisk) trend = 'declining';
        else trend = 'stable';
    }

    return {
        score,
        severityDistribution: distribution,
        regressionCount,
        trend
    };
}
