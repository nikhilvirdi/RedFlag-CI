import { filterFalsePositives, recordFalsePositive } from './falsePositive.service';

jest.mock('../config/db', () => ({
    prisma: {
        $queryRawUnsafe: jest.fn(),
        $executeRawUnsafe: jest.fn(),
    },
}));

jest.mock('./memory.service', () => ({
    getEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn() },
}));

import { prisma } from '../config/db';
import { ScanFinding } from './scan.service';

const mockQueryRaw = prisma.$queryRawUnsafe as jest.Mock;
const mockExecuteRaw = prisma.$executeRawUnsafe as jest.Mock;

function makeFinding(overrides: Partial<ScanFinding> = {}): ScanFinding {
    return {
        type: 'credential',
        severity: 'high',
        confidence: 'high',
        file: 'src/config.ts',
        line: 5,
        description: 'Hardcoded secret',
        original_code: "const secret = 'abc123';",
        ...overrides,
    };
}

beforeEach(() => jest.clearAllMocks());

describe('falsePositive.service', () => {
    describe('filterFalsePositives', () => {
        it('filters out findings that match a false positive at threshold', async () => {
            mockQueryRaw.mockResolvedValue([{ id: 'fp-1', findingType: 'credential', similarity: 0.97 }]);

            const result = await filterFalsePositives([makeFinding()], 'repo-1');

            expect(result).toHaveLength(0);
        });

        it('passes through findings below the similarity threshold', async () => {
            mockQueryRaw.mockResolvedValue([{ id: 'fp-1', findingType: 'credential', similarity: 0.5 }]);

            const result = await filterFalsePositives([makeFinding()], 'repo-1');

            expect(result).toHaveLength(1);
        });

        it('passes through findings when no false positives exist', async () => {
            mockQueryRaw.mockResolvedValue([]);

            const result = await filterFalsePositives([makeFinding()], 'repo-1');

            expect(result).toHaveLength(1);
        });
    });

    describe('recordFalsePositive', () => {
        it('calls $executeRawUnsafe to insert a false positive record', async () => {
            mockExecuteRaw.mockResolvedValue(1);

            await recordFalsePositive('repo-1', 'credential', 'src/config.ts', "const secret = 'abc'", 'user-1');

            expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
            expect(mockExecuteRaw).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "FalsePositive"'), expect.any(String), 'credential', 'src/config.ts', "const secret = 'abc'", expect.any(String), 'user-1');
        });
    });
});
