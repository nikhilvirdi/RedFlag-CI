import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

interface JwtPayload {
    sub: string;
    iat: number;
    exp: number;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
        });
        return;
    }

    const token = authHeader.slice(7);

    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

        req.userId = payload.sub;

        next();

    } catch (error: unknown) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                error: 'TokenExpired',
                message: 'Your session has expired. Please log in again.',
            });
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                error: 'InvalidToken',
                message: 'The provided token is invalid.',
            });
            return;
        }

        next(error);
    }
}
