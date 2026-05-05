import { logger } from '../utils/logger';
import { prisma } from '../config/db';
import { ScanFinding } from './scan.service';
import { getEmbedding } from './memory.service';

const SIMILARITY_THRESHOLD = 0.88;
const MAX_SIMILAR_PER_FINDING = 3;

export interface SimilarityMatch {
    file: string;
    findingType: string;
    similarity: number;
}

export interface SimilarityAnnotation {
    finding: ScanFinding;
    matches: SimilarityMatch[];
}

type SimilarityRow = {
    file: string;
    findingType: string;
    similarity: number;
};

export async function scanForSimilarPatterns(
    findings: ScanFinding[],
    repositoryId: string
): Promise<SimilarityAnnotation[]> {
    const annotations: SimilarityAnnotation[] = [];

    await Promise.allSettled(
        findings.map(async (finding) => {
            try {
                const vector = await getEmbedding(finding.original_code);
                const vectorStr = `[${vector.join(',')}]`;

                const rows = await prisma.$queryRawUnsafe<SimilarityRow[]>(
                    `SELECT file, "findingType", 1 - (embedding <=> $1::vector) AS similarity
                     FROM "CodeEmbedding"
                     WHERE "repositoryId" = $2
                       AND file != $3
                     ORDER BY embedding <=> $1::vector
                     LIMIT $4`,
                    vectorStr,
                    repositoryId,
                    finding.file,
                    MAX_SIMILAR_PER_FINDING
                );

                const above = rows.filter((r) => Number(r.similarity) >= SIMILARITY_THRESHOLD);

                if (above.length > 0) {
                    annotations.push({
                        finding,
                        matches: above.map((r) => ({
                            file:        r.file,
                            findingType: r.findingType,
                            similarity:  Number(r.similarity),
                        })),
                    });
                }
            } catch (e) {
                logger.warn(`[Similarity] Scan skipped for finding in ${finding.file}: ${e}`);
            }
        })
    );

    logger.info(`[Similarity] ${annotations.length} finding(s) have semantically similar patterns in the codebase.`);
    return annotations;
}
