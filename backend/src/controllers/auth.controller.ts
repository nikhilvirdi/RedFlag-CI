import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { buildGitHubAuthUrl, handleGitHubOAuthCallback } from '../services/auth.service';
import { storeOAuthState, validateAndConsumeOAuthState } from '../services/oauthState.service';
import { logger } from '../utils/logger';

export async function redirectToGitHub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { url, state } = buildGitHubAuthUrl();

        await storeOAuthState(state);

        logger.info(`[AuthController] Initiating GitHub OAuth redirect. State: ${state.slice(0, 8)}...`);

        res.redirect(302, url);
    } catch (error) {
        next(error);
    }
}

export async function handleOAuthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { code, state, error } = req.query as Record<string, string>;

        if (error) {
            logger.warn(`[AuthController] GitHub OAuth denied by user. Error: ${error}`);
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=access_denied`);
            return;
        }

        if (!code || !state) {
            logger.warn('[AuthController] Missing code or state in OAuth callback.');
            res.status(400).json({ error: 'Missing code or state parameter.' });
            return;
        }

        const isValid = await validateAndConsumeOAuthState(state);
        if (!isValid) {
            logger.warn(`[AuthController] OAuth state invalid or expired: ${state.slice(0, 8)}...`);
            res.status(400).json({ error: 'Invalid or expired OAuth state. Please try logging in again.' });
            return;
        }

        logger.info('[AuthController] OAuth state validated. Processing callback...');

        const sessionToken = await handleGitHubOAuthCallback(code);

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/success#token=${sessionToken}`);

    } catch (error) {
        next(error);
    }
}

export async function getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing or malformed Authorization header.' });
            return;
        }

        const token = authHeader.slice(7);

        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string };

        const user = await prisma.user.findUnique({
            where:  { id: payload.sub },
            select: { id: true, name: true, email: true, avatarUrl: true, githubId: true },
        });

        if (!user) {
            res.status(401).json({ error: 'User not found.' });
            return;
        }

        res.status(200).json({ user });
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({ error: 'Session expired. Please log in again.' });
            return;
        }
        if (error.name === 'JsonWebTokenError') {
            res.status(401).json({ error: 'Invalid token.' });
            return;
        }
        next(error);
    }
}
