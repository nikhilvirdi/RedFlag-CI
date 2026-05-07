import { prisma } from '../config/db';
import { logger } from '../utils/logger';

interface AuditEntry {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
}

export async function recordAuditEvent(entry: AuditEntry): Promise<void> {
    try {
        await prisma.auditLog.create({ data: entry });
    } catch (error) {
        logger.warn('[AuditService] Failed to record audit event', { entry, error });
    }
}

export async function getAuditLogs(
    userId: string,
    page: number = 1,
    pageSize: number = 25,
    action?: string
) {
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { userId };
    if (action) {
        where.action = action;
    }

    const [logs, totalCount] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        data: logs,
        pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
        },
    };
}
