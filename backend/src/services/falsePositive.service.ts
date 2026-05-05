import { logger } from '../utils/logger';
import { prisma } from '../config/db';
import { ScanFinding } from './scan.service';
import { getEmbedding } from './memory.service';

const FP_SIMILARITY_THRESHOLD = 0.95;
const MAX_FP_CANDIDATES = 20;

type FpRow = {
    id: string;
    findingType: string;
    similarity: number;
};

export async function filterFalsePositives(
    findings: ScanFinding[],
    repositoryId: string
): Promise<ScanFinding[]> {
    const retained: ScanFinding[] = [];

    await Promise.allSettled(
        findings.map(async (finding) => {
            try {
                const vector = await getEmbedding(finding.original_code);
                const vectorStr = `[${vector.join(',')}]`;

                const rows = await prisma.$queryRawUnsafe<FpRow[]>(
                    `SELECT id, "findingType", 1 - (embedding <=> $1::vector) AS similarity
                     FROM "FalsePositive"
                     WHERE "repositoryId" = $2
                       AND "findingType" = $3
                     ORDER BY embedding <=> $1::vector
                     LIMIT $4`,
                    vectorStr,
                    repositoryId,
                    finding.type,
                    MAX_FP_CANDIDATES
                );

                const isFp = rows.some((r) => Number(r.similarity) >= FP_SIMILARITY_THRESHOLD);

                if (!isFp) {
                    retained.push(finding);
                } else {
                    logger.info(`[FalsePositive] Filtered finding in ${finding.file} (type=${finding.type}, similarity>=${FP_SIMILARITY_THRESHOLD}).`);
                }
            } catch (e) {
                logger.warn(`[FalsePositive] Lookup failed for finding in ${finding.file} — passing through. ${e}`);
                retained.push(finding);
            }
        })
    );

    return retained;
}

export async function recordFalsePositive(
    repositoryId: string,
    findingType: string,
    file: string,
    codeSnippet: string,
    dismissedBy: string
): Promise<void> {
    const vector = await getEmbedding(codeSnippet);
    const vectorStr = `[${vector.join(',')}]`;

    await prisma.$executeRawUnsafe(
        `INSERT INTO "FalsePositive" (id, "repositoryId", "findingType", file, "codeSnippet", embedding, "dismissedBy", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, $6, NOW())`,
        repositoryId,
        findingType,
        file,
        codeSnippet,
        vectorStr,
        dismissedBy
    );

    logger.info(`[FalsePositive] Pattern recorded for type=${findingType} in repo ${repositoryId}.`);
}
