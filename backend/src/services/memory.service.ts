import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../config/db';
import { ScanFinding } from './scan.service';

const SIMILARITY_THRESHOLD = 0.92;
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const MAX_SNIPPET_CHARS = 8000;

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function getEmbedding(text: string): Promise<number[]> {
    const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.slice(0, MAX_SNIPPET_CHARS),
    });
    return response.data[0].embedding;
}

type SimilarityRow = { similarity: number };

export async function detectRegressions(
    findings: ScanFinding[],
    repositoryId: string
): Promise<void> {
    await Promise.allSettled(
        findings.map(async (finding) => {
            try {
                const vector = await getEmbedding(finding.original_code);
                const vectorStr = `[${vector.join(',')}]`;

                const rows = await prisma.$queryRawUnsafe<SimilarityRow[]>(
                    `SELECT 1 - (embedding <=> $1::vector) AS similarity
                     FROM "CodeEmbedding"
                     WHERE "repositoryId" = $2
                     ORDER BY embedding <=> $1::vector
                     LIMIT 1`,
                    vectorStr,
                    repositoryId
                );

                if (rows.length > 0 && Number(rows[0].similarity) >= SIMILARITY_THRESHOLD) {
                    finding.isRegression = true;
                    finding.description = `[REGRESSION] ${finding.description}`;
                }
            } catch (e) {
                logger.warn(`[Memory] Regression check skipped for finding in ${finding.file}: ${e}`);
            }
        })
    );
}

export async function storeEmbeddings(
    findings: ScanFinding[],
    repositoryId: string,
    scanResultId: string
): Promise<void> {
    await Promise.allSettled(
        findings.map(async (finding) => {
            try {
                const vector = await getEmbedding(finding.original_code);
                const vectorStr = `[${vector.join(',')}]`;

                await prisma.$executeRawUnsafe(
                    `INSERT INTO "CodeEmbedding" (id, "repositoryId", "findingType", file, "codeSnippet", embedding, "scanResultId", "createdAt")
                     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, $6, NOW())`,
                    repositoryId,
                    finding.type,
                    finding.file,
                    finding.original_code,
                    vectorStr,
                    scanResultId
                );
            } catch (e) {
                logger.warn(`[Memory] Embedding storage skipped for finding in ${finding.file}: ${e}`);
            }
        })
    );
}
