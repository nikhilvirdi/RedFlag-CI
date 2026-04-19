/**
 * Authenticate Middleware — JWT Session Guard
 * ────────────────────────────────────────────
 *
 * This middleware protects API routes that require a logged-in user.
 * It intercepts every request to a protected route, extracts the JWT
 * from the Authorization header, verifies it, and attaches the
 * authenticated user's ID to the request object.
 *
 * If the token is missing, invalid, or expired, the request is
 * rejected with a 401 Unauthorized response before it ever reaches
 * the controller.
 *
 * 💡 Middleware pattern in Express:
 * ───────────────────────────────────
 * Express middleware is a function with (req, res, next) signature.
 * - Call next()          → pass request to the next middleware/handler
 * - Call res.status().json() → terminate the chain, respond immediately
 * - Call next(error)     → skip to the global error handler
 *
 * By calling next() ONLY when the token is valid, we create a
 * "gateway" that every subsequent handler can trust: if execution
 * reaches the controller, req.userId is guaranteed to be valid.
 *
 * 💡 What is req.userId?
 * ────────────────────────
 * req is Express's Request object. TypeScript doesn't know about our
 * custom properties. We use declaration merging (see types/ directory)
 * to extend the Request interface with our custom `userId` field.
 * This keeps TypeScript happy without using `any` casts everywhere.
 *
 * 💡 Why Authorization: Bearer <token> instead of a cookie?
 * ───────────────────────────────────────────────────────────
 * Bearer token auth is stateless and works well for:
 *   - Single Page Applications (SPAs) making fetch() requests
 *   - Mobile apps that can't use cookies
 *   - APIs that are consumed across different origins
 * The trade-off vs. HttpOnly cookies is that JS can read the token from
 * localStorage (XSS risk). For this project's scope, Bearer tokens are fine.
 * A production hardening step would be to switch to HttpOnly SameSite cookies.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// ─────────────────────────────────────────────────────────────────────────────
// TYPE AUGMENTATION
// ─────────────────────────────────────────────────────────────────────────────
// We extend Express's Request type so that TypeScript knows about our custom
// `userId` property. Without this, accessing `req.userId` would throw a type error.
// This merges with Express's own type declarations — it doesn't replace them.
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string; // Set by authenticate middleware on valid JWT
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT PAYLOAD TYPE
// ─────────────────────────────────────────────────────────────────────────────
interface JwtPayload {
    sub: string; // subject = our internal user UUID
    iat: number; // issued at (Unix timestamp)
    exp: number; // expires at (Unix timestamp)
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

export function authenticate(req: Request, res: Response, next: NextFunction): void {
    // ── Step 1: Extract the token from the Authorization header ─────────────
    // Expected format: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
        });
        return;
    }

    // Slice off "Bearer " (7 characters) to get just the token string
    const token = authHeader.slice(7);

    // ── Step 2: Verify the token's signature and expiry ─────────────────────
    // jwt.verify() does two things:
    //   1. Recomputes the HMAC-SHA256 signature using our JWT_SECRET
    //   2. Compares it to the signature embedded in the token
    // If they don't match (tampered token) OR the token is expired, it throws.
    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

        // ── Step 3: Attach the user ID to the request ────────────────────────
        // From this point forward, every handler that runs after this middleware
        // can access req.userId with confidence that it's a valid, authenticated user.
        req.userId = payload.sub;

        // ── Step 4: Pass control to the next handler ─────────────────────────
        next();

    } catch (error: unknown) {
        // jwt.verify throws typed errors we can handle specifically
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

        // For any other unexpected error, delegate to global error handler
        next(error);
    }
}
