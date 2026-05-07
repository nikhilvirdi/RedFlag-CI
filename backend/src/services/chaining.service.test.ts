import { chainFindings, VulnerabilityChain } from './chaining.service';

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('./scan.service', () => ({}));

function makeFinding(overrides: Record<string, unknown> = {}) {
    return {
        type: 'sql_injection',
        severity: 'high',
        confidence: 'high',
        file: 'app.ts',
        line: 1,
        description: 'test finding',
        original_code: 'SELECT * FROM users',
        ...overrides,
    } as any;
}

describe('chaining.service', () => {
    it('returns empty array when no chainable findings exist', () => {
        const findings = [makeFinding({ type: 'dead_code' })];
        const chains = chainFindings(findings);

        expect(chains).toEqual([]);
    });

    it('chains prompt_injection → credential into a single chain', () => {
        const findings = [
            makeFinding({ type: 'prompt_injection', severity: 'high', file: 'a.ts' }),
            makeFinding({ type: 'credential', severity: 'critical', file: 'b.ts' }),
        ];
        const chains = chainFindings(findings);

        expect(chains.length).toBe(1);
        expect(chains[0].types).toContain('prompt_injection');
        expect(chains[0].types).toContain('credential');
        expect(chains[0].severity).toBe('critical');
    });

    it('escalates severity when chain has 3+ findings', () => {
        const findings = [
            makeFinding({ type: 'prompt_injection', severity: 'medium' }),
            makeFinding({ type: 'dangerous_pattern', severity: 'medium' }),
            makeFinding({ type: 'credential', severity: 'medium' }),
        ];
        const chains = chainFindings(findings);

        expect(chains.length).toBe(1);
        expect(chains[0].severity).toBe('high');
        expect(chains[0].count).toBe(3);
    });

    it('does not chain unrelated finding types', () => {
        const findings = [
            makeFinding({ type: 'sql_injection' }),
            makeFinding({ type: 'license_risk' }),
        ];
        const chains = chainFindings(findings);

        expect(chains).toEqual([]);
    });
});
