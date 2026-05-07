import { prisma } from '../config/db';

interface SarifResult {
    ruleId: string;
    level: string;
    message: { text: string };
    locations: Array<{
        physicalLocation: {
            artifactLocation: { uri: string };
            region?: { startLine: number };
        };
    }>;
    properties?: Record<string, unknown>;
}

interface SarifRule {
    id: string;
    shortDescription: { text: string };
    defaultConfiguration: { level: string };
}

const SEVERITY_TO_SARIF_LEVEL: Record<string, string> = {
    CRITICAL: 'error',
    HIGH: 'error',
    MEDIUM: 'warning',
    LOW: 'note',
    CLEAN: 'none',
};

export async function generateSarifForRepository(repositoryId: string) {
    const latestScan = await prisma.scanResult.findFirst({
        where: { repositoryId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        include: {
            findings: { include: { remediation: true } },
            riskScore: true,
            repository: { select: { fullName: true } },
        },
    });

    if (!latestScan) {
        throw new Error('No completed scans found for this repository.');
    }

    const rulesMap = new Map<string, SarifRule>();
    const results: SarifResult[] = [];

    for (const finding of latestScan.findings) {
        const ruleId = finding.category.toLowerCase().replace(/[\s\/]+/g, '-');

        if (!rulesMap.has(ruleId)) {
            rulesMap.set(ruleId, {
                id: ruleId,
                shortDescription: { text: finding.category },
                defaultConfiguration: {
                    level: SEVERITY_TO_SARIF_LEVEL[finding.severity] ?? 'warning',
                },
            });
        }

        const result: SarifResult = {
            ruleId,
            level: SEVERITY_TO_SARIF_LEVEL[finding.severity] ?? 'warning',
            message: { text: finding.description },
            locations: [{
                physicalLocation: {
                    artifactLocation: { uri: finding.file },
                    ...(finding.lineNumber ? { region: { startLine: finding.lineNumber } } : {}),
                },
            }],
        };

        if (finding.remediation) {
            result.properties = {
                remediation: {
                    type: finding.remediation.type,
                    correctedCode: finding.remediation.correctedCode,
                    recommendation: finding.remediation.recommendation,
                },
            };
        }

        results.push(result);
    }

    return {
        $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
        version: '2.1.0',
        runs: [{
            tool: {
                driver: {
                    name: 'RedFlag CI',
                    version: '1.0.0',
                    informationUri: 'https://github.com/nikhilvirdi/RedFlag-CI',
                    rules: Array.from(rulesMap.values()),
                },
            },
            results,
            properties: {
                scanId: latestScan.id,
                repositoryFullName: latestScan.repository.fullName,
                commitSha: latestScan.commitSha,
                riskScore: latestScan.riskScore?.totalScore ?? 0,
                riskClassification: latestScan.riskScore?.classification ?? 'CLEAN',
            },
        }],
    };
}
