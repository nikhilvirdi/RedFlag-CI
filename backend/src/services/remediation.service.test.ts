import { remediateFindings } from './remediation.service';

jest.mock('../config/env', () => ({
    env: { ANTHROPIC_API_KEY: 'test-key', OPENAI_API_KEY: 'test-key' },
}));

jest.mock('@anthropic-ai/sdk', () => ({
    default: jest.fn().mockImplementation(() => ({
        messages: {
            create: jest.fn().mockResolvedValue({
                content: [{ type: 'text', text: 'fixed_code\nUse parameterized queries.' }],
                usage: { input_tokens: 100, output_tokens: 50 },
            }),
        },
    })),
}));

jest.mock('./claudeRateLimit.service', () => ({
    canCallClaude: jest.fn().mockResolvedValue({ allowed: true }),
    recordClaudeUsage: jest.fn().mockResolvedValue(undefined),
    tripCircuitBreaker: jest.fn().mockResolvedValue(undefined),
}));

import { ScanFinding } from './scan.service';

function makeFinding(overrides: Partial<ScanFinding> = {}): ScanFinding {
    return {
        type: 'sql_injection',
        severity: 'critical',
        confidence: 'high',
        file: 'src/db.ts',
        line: 10,
        description: 'SQL injection via string concat',
        original_code: 'SELECT * FROM users WHERE id = ' + "'$userId'",
        ...overrides,
    };
}

beforeEach(() => jest.clearAllMocks());

describe('remediation.service', () => {
    describe('remediateFindings', () => {
        it('returns original findings unchanged when none are eligible', async () => {
            const findings = [makeFinding({ severity: 'low', confidence: 'low' })];

            const result = await remediateFindings(findings);

            expect(result).toHaveLength(1);
            expect(result[0].remediated_code).toBeUndefined();
        });

        it('adds remediated_code and recommendation for eligible findings', async () => {
            const findings = [makeFinding()];

            const result = await remediateFindings(findings);

            expect(result).toHaveLength(1);
            expect(result[0].remediated_code).toBe('fixed_code');
            expect(result[0].recommendation).toBe('Use parameterized queries.');
        });

        it('handles empty findings list', async () => {
            const result = await remediateFindings([]);
            expect(result).toHaveLength(0);
        });
    });
});
