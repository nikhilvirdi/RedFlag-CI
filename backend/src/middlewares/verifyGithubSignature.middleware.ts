import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export function verifyGithubSignature(req: Request, _res: Response, next: NextFunction): void {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!secret) {
        logger.error('SECURITY: GITHUB_WEBHOOK_SECRET is not set. Rejecting all webhook traffic.');
        next(new Error('Webhook secret is not configured on this server.'));
        return;
    }

    if (!signature) {
        logger.warn('SECURITY: Webhook received with no x-hub-signature-256 header. Rejecting.');
        const err = Object.assign(new Error('Missing webhook signature.'), { statusCode: 401 });
        next(err);
        return;
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
        logger.error('INTEGRITY: rawBody was not attached to the request. Check express.json() configuration in app.ts.');
        next(new Error('Internal signature verification error.'));
        return;
    }

    const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    const trusted = Buffer.from(expectedSignature, 'utf8');
    const received = Buffer.from(signature, 'utf8');

    if (trusted.length !== received.length || !crypto.timingSafeEqual(trusted, received)) {
        logger.warn(`SECURITY: Invalid webhook signature. Potential spoofed request rejected.`);
        const err = Object.assign(new Error('Invalid webhook signature.'), { statusCode: 401 });
        next(err);
        return;
    }

    logger.debug('Webhook signature verified successfully.');
    next();
}
