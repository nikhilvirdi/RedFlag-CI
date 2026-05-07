import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

function getCurrentPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
}

export async function enforceApiQuota(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const userId = req.userId;
    if (!userId) {
        next();
        return;
    }

    try {
        const { start, end } = getCurrentPeriod();

        const quota = await prisma.apiQuota.upsert({
            where: { userId_periodStart: { userId, periodStart: start } },
            update: { requestCount: { increment: 1 } },
            create: {
                userId,
                periodStart: start,
                periodEnd: end,
                requestCount: 1,
            },
        });

        if (quota.requestCount > quota.requestLimit) {
            res.status(429).json({
                error: 'Monthly API quota exceeded.',
                limit: quota.requestLimit,
                used: quota.requestCount,
                resetsAt: quota.periodEnd.toISOString(),
            });
            return;
        }

        res.setHeader('X-RateLimit-Limit', quota.requestLimit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, quota.requestLimit - quota.requestCount));
        res.setHeader('X-RateLimit-Reset', quota.periodEnd.toISOString());

        next();
    } catch (error) {
        next();
    }
}

export async function enforceScanQuota(userId: string): Promise<void> {
    const { start, end } = getCurrentPeriod();

    const quota = await prisma.apiQuota.upsert({
        where: { userId_periodStart: { userId, periodStart: start } },
        update: { scanCount: { increment: 1 } },
        create: {
            userId,
            periodStart: start,
            periodEnd: end,
            scanCount: 1,
        },
    });

    if (quota.scanCount > quota.scanLimit) {
        throw new Error(`Monthly scan quota exceeded. Limit: ${quota.scanLimit}, Used: ${quota.scanCount}. Resets: ${quota.periodEnd.toISOString()}`);
    }
}
