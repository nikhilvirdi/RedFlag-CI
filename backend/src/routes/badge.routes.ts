import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { generateBadgeSvg } from '../services/badge.service';

const badgeRouter = Router();

badgeRouter.get('/:repositoryId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { repositoryId } = req.params;
        if (!repositoryId) {
            res.status(400).json({ error: 'repositoryId is required.' });
            return;
        }

        const svg = await generateBadgeSvg(repositoryId);

        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).send(svg);
    } catch (error) {
        next(error);
    }
});

export { badgeRouter };
