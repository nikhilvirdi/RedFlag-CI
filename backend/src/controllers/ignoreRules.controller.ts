import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { recordFalsePositive } from '../services/falsePositive.service';

export async function createIgnoreRuleHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId, findingType, file, codeSnippet } = req.body;

        if (!repositoryId || !findingType || !file || !codeSnippet) {
            res.status(400).json({ error: 'repositoryId, findingType, file, and codeSnippet are required.' });
            return;
        }

        const repo = await prisma.repository.findFirst({
            where: { id: repositoryId, userId },
        });

        if (!repo) {
            res.status(404).json({ error: 'Repository not found or not owned by authenticated user.' });
            return;
        }

        await recordFalsePositive(repositoryId, findingType, file, codeSnippet, userId);

        res.status(201).json({ message: 'Ignore rule created successfully.' });
    } catch (error) {
        next(error);
    }
}

export async function listIgnoreRulesHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId } = req.query;

        if (!repositoryId || typeof repositoryId !== 'string') {
            res.status(400).json({ error: 'repositoryId query parameter is required.' });
            return;
        }

        const repo = await prisma.repository.findFirst({
            where: { id: repositoryId, userId },
        });

        if (!repo) {
            res.status(404).json({ error: 'Repository not found or not owned by authenticated user.' });
            return;
        }

        type FpRecord = {
            id: string;
            repositoryId: string;
            findingType: string;
            file: string;
            codeSnippet: string;
            dismissedBy: string;
            createdAt: Date;
        };

        const rules = await prisma.$queryRawUnsafe<FpRecord[]>(
            `SELECT id, "repositoryId", "findingType", file, "codeSnippet", "dismissedBy", "createdAt"
             FROM "FalsePositive"
             WHERE "repositoryId" = $1
             ORDER BY "createdAt" DESC`,
            repositoryId
        );

        res.status(200).json({ rules });
    } catch (error) {
        next(error);
    }
}

export async function deleteIgnoreRuleHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ error: 'id param is required.' });
            return;
        }

        type FpRow = { id: string; repositoryId: string };

        const rows = await prisma.$queryRawUnsafe<FpRow[]>(
            `SELECT id, "repositoryId" FROM "FalsePositive" WHERE id = $1`,
            id
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Ignore rule not found.' });
            return;
        }

        const repo = await prisma.repository.findFirst({
            where: { id: rows[0].repositoryId, userId },
        });

        if (!repo) {
            res.status(403).json({ error: 'Not authorized to delete this ignore rule.' });
            return;
        }

        await prisma.$executeRawUnsafe(
            `DELETE FROM "FalsePositive" WHERE id = $1`,
            id
        );

        res.status(200).json({ message: 'Ignore rule deleted successfully.' });
    } catch (error) {
        next(error);
    }
}
