import { Request, Response, NextFunction } from 'express';
import { getAuditLogs } from '../services/audit.service';

export async function getAuditLogsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 25));
        const action = req.query.action as string | undefined;

        const result = await getAuditLogs(userId, page, pageSize, action);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}
