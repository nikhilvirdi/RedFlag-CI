import { logger } from '../utils/logger';
import { ScanFinding } from './scan.service';

export interface VulnerabilityChain {
    name: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    types: string[];
    files: string[];
    count: number;
}

const SEVERITY_RANK: Record<string, number> = {
    critical: 4,
    high:     3,
    medium:   2,
    low:      1,
};

const RANK_TO_SEVERITY: Record<number, 'critical' | 'high' | 'medium' | 'low'> = {
    4: 'critical',
    3: 'high',
    2: 'medium',
    1: 'low',
};

const CHAIN_GRAPH: Record<string, string[]> = {
    prompt_injection:  ['dangerous_pattern', 'credential', 'input_validation'],
    input_validation:  ['sql_injection', 'dangerous_pattern', 'credential'],
    sql_injection:     ['credential'],
    dangerous_pattern: ['credential'],
    ghost_dependency:  ['hallucinated_package'],
    dead_code:         [],
};

function maxSeverity(findings: ScanFinding[]): 'critical' | 'high' | 'medium' | 'low' {
    const rank = findings.reduce((max, f) => Math.max(max, SEVERITY_RANK[f.severity] ?? 1), 1);
    return RANK_TO_SEVERITY[rank];
}

function escalate(sev: 'critical' | 'high' | 'medium' | 'low'): 'critical' | 'high' | 'medium' | 'low' {
    return RANK_TO_SEVERITY[Math.min((SEVERITY_RANK[sev] ?? 1) + 1, 4)];
}

export function chainFindings(findings: ScanFinding[]): VulnerabilityChain[] {
    const chains: VulnerabilityChain[] = [];
    const used = new Set<number>();

    for (let i = 0; i < findings.length; i++) {
        if (used.has(i)) continue;

        const root = findings[i];
        const downstreamTypes = CHAIN_GRAPH[root.type] ?? [];
        if (downstreamTypes.length === 0) continue;

        const linked: ScanFinding[] = [root];
        const linkedIndices: number[] = [i];

        for (let j = 0; j < findings.length; j++) {
            if (i === j || used.has(j)) continue;
            if (downstreamTypes.includes(findings[j].type)) {
                linked.push(findings[j]);
                linkedIndices.push(j);
            }
        }

        if (linked.length < 2) continue;

        linkedIndices.forEach((idx) => used.add(idx));

        const types = Array.from(new Set(linked.map((f) => f.type)));
        const files = Array.from(new Set(linked.map((f) => f.file)));
        const base = maxSeverity(linked);
        const severity = linked.length >= 3 ? escalate(base) : base;

        chains.push({
            name:     types.join(' → '),
            severity,
            types,
            files,
            count:    linked.length,
        });
    }

    logger.info(`[Chaining] Identified ${chains.length} vulnerability chain(s).`);
    return chains;
}
