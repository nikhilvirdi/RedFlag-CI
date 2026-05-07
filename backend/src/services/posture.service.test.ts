jest.mock('../config/db', () => ({
    prisma: {
        scanResult: {
            findMany: jest.fn(),
        },
    },
}));

import { calculatePostureScore } from './posture.service';
import { prisma } from '../config/db';

const mockFindMany = prisma.scanResult.findMany as jest.Mock;

describe('posture.service', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns score 100 and insufficient_data when no scans exist', async () => {
        mockFindMany.mockResolvedValue([]);

        const result = await calculatePostureScore('repo-1');

        expect(result.score).toBe(100);
        expect(result.trend).toBe('insufficient_data');
        expect(result.severityDistribution).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
    });

    it('deducts points for each severity level', async () => {
        mockFindMany.mockResolvedValue([{
            findings: [
                { severity: 'CRITICAL', description: 'crit' },
                { severity: 'HIGH', description: 'high' },
                { severity: 'MEDIUM', description: 'med' },
                { severity: 'LOW', description: 'low' },
            ],
            riskScore: { totalScore: 50 },
        }]);

        const result = await calculatePostureScore('repo-1');

        expect(result.score).toBe(100 - 20 - 10 - 5 - 2);
        expect(result.severityDistribution.critical).toBe(1);
        expect(result.severityDistribution.high).toBe(1);
    });

    it('counts regressions and deducts additional points', async () => {
        mockFindMany.mockResolvedValue([{
            findings: [
                { severity: 'HIGH', description: '[REGRESSION] leaked credential' },
            ],
            riskScore: { totalScore: 30 },
        }]);

        const result = await calculatePostureScore('repo-1');

        expect(result.regressionCount).toBe(1);
        expect(result.score).toBe(100 - 10 - 5);
    });

    it('clamps score to minimum 0', async () => {
        const criticals = Array.from({ length: 10 }, (_, i) => ({
            severity: 'CRITICAL',
            description: `crit-${i}`,
        }));
        mockFindMany.mockResolvedValue([{
            findings: criticals,
            riskScore: { totalScore: 100 },
        }]);

        const result = await calculatePostureScore('repo-1');

        expect(result.score).toBe(0);
    });

    it('determines trend as improving when current risk is lower', async () => {
        mockFindMany.mockResolvedValue([
            { findings: [], riskScore: { totalScore: 20 } },
            { findings: [], riskScore: { totalScore: 50 } },
        ]);

        const result = await calculatePostureScore('repo-1');

        expect(result.trend).toBe('improving');
    });
});
