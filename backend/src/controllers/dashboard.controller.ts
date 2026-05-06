import { Request, Response, NextFunction } from 'express';
import {
    getRepositoriesForUser,
    getRepositoryByIdForUser,
    getScanResultsForRepository,
    getScanResultById,
    getDashboardStats,
} from '../services/dashboard.service';
import { addScanJob } from '../queues/scan.queue';
import { getRepositoryContext } from '../services/github.service';

export async function getDashboardStatsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const stats = await getDashboardStats(userId);
        res.status(200).json({ stats });
    } catch (error) {
        next(error);
    }
}

export async function getRepositoriesHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const repositories = await getRepositoriesForUser(userId);
        res.status(200).json({ repositories });
    } catch (error) {
        next(error);
    }
}

export async function getRepositoryHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId } = req.params;

        if (!repositoryId) {
            res.status(400).json({ error: 'repositoryId is required.' });
            return;
        }

        const repository = await getRepositoryByIdForUser(repositoryId as string, userId);

        if (!repository) {
            res.status(404).json({ error: 'Repository not found.' });
            return;
        }

        res.status(200).json({ repository });
    } catch (error) {
        next(error);
    }
}

export async function getScanResultsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { repositoryId } = req.params;

        if (!repositoryId) {
            res.status(400).json({ error: 'repositoryId is required.' });
            return;
        }

        const page     = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10));

        const result = await getScanResultsForRepository(repositoryId as string, page, pageSize);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getScanResultDetailHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { scanResultId } = req.params;

        if (!scanResultId) {
            res.status(400).json({ error: 'scanResultId is required.' });
            return;
        }

        const scanResult = await getScanResultById(scanResultId as string);

        if (!scanResult) {
            res.status(404).json({ error: 'Scan result not found.' });
            return;
        }

        res.status(200).json({ scanResult });
    } catch (error) {
        next(error);
    }
}

export async function rescanRepositoryHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId } = req.params;

        if (!repositoryId) {
            res.status(400).json({ error: 'repositoryId is required.' });
            return;
        }

        const repository = await getRepositoryByIdForUser(repositoryId as string, userId);

        if (!repository) {
            res.status(404).json({ error: 'Repository not found or access denied.' });
            return;
        }

        const [owner, repo] = repository.fullName.split('/');
        const context = await getRepositoryContext(owner, repo);

        await addScanJob({
            installationId: context.installationId,
            repositoryFullName: repository.fullName,
            pullRequestNumber: 0,
            headSha: context.headSha,
            baseRef: context.defaultBranch,
        });

        res.status(202).json({
            message: 'Rescan job enqueued successfully.',
            context: {
                branch: context.defaultBranch,
                commit: context.headSha,
            },
        });
    } catch (error) {
        next(error);
    }
}

import { calculatePostureScore } from '../services/posture.service';

export async function getPostureHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId } = req.params;

        if (!repositoryId) {
            res.status(400).json({ error: 'repositoryId is required.' });
            return;
        }

        const repository = await getRepositoryByIdForUser(repositoryId as string, userId);

        if (!repository) {
            res.status(404).json({ error: 'Repository not found or access denied.' });
            return;
        }

        const posture = await calculatePostureScore(repository.id);

        res.status(200).json({ posture });
    } catch (error) {
        next(error);
    }
}

import { getRiskTrendForRepository, getAiImpactForRepository } from '../services/dashboard.service';

export async function getRiskTrendHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId } = req.params;

        if (!repositoryId) {
            res.status(400).json({ error: 'repositoryId is required.' });
            return;
        }

        const repository = await getRepositoryByIdForUser(repositoryId as string, userId);

        if (!repository) {
            res.status(404).json({ error: 'Repository not found or access denied.' });
            return;
        }

        let days = parseInt(req.query.days as string, 10);
        if (isNaN(days) || days <= 0) {
            days = 30;
        }
        days = Math.min(days, 90); // max 90 days

        const trend = await getRiskTrendForRepository(repository.id, days);

        res.status(200).json({ trend });
    } catch (error) {
        next(error);
    }
}

export async function getAiImpactHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { repositoryId } = req.params;

        if (!repositoryId) {
            res.status(400).json({ error: 'repositoryId is required.' });
            return;
        }

        const repository = await getRepositoryByIdForUser(repositoryId as string, userId);

        if (!repository) {
            res.status(404).json({ error: 'Repository not found or access denied.' });
            return;
        }

        let days = parseInt(req.query.days as string, 10);
        if (isNaN(days) || days <= 0) {
            days = 30;
        }
        days = Math.min(days, 90); // max 90 days

        const aiImpact = await getAiImpactForRepository(repository.id, days);

        res.status(200).json({ aiImpact });
    } catch (error) {
        next(error);
    }
}
