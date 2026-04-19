/**
 * Auth Controller — HTTP Layer for GitHub OAuth
 * ─────────────────────────────────────────────
 *
 * Controllers are the HTTP "edge" of the application. Their only responsibilities:
 *   1. Parse the HTTP request (extract query params, validate inputs)
 *   2. Call the service layer (delegate all real work)
 *   3. Send the HTTP response (status code + body)
 *
 * They contain ZERO business logic. If you find yourself writing an SQL query
 * or making an HTTP request inside a controller, move it to a service.
 *
 * This controller handles TWO endpoints:
 *
 *   GET /api/auth/github/redirect
 *   ──────────────────────────────
 *   Redirects the user to GitHub's OAuth authorization page.
 *   Called when the frontend's "Sign in with GitHub" button is clicked.
 *
 *   GET /api/auth/github/callback
 *   ──────────────────────────────
 *   GitHub redirects here after the user authorizes (or denies) the app.
 *   Exchanges the code for a JWT and sends it to the frontend.
 */

import { Request, Response, NextFunction } from 'express';
import { buildGitHubAuthUrl, handleGitHubOAuthCallback } from '../services/auth.service';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// STATE STORE (In-Memory)
// ─────────────────────────────────────────────────────────────────────────────
// We use a simple Map to temporarily store valid OAuth state values.
// When the /redirect endpoint generates a state string, it stores it here.
// When /callback receives a state from GitHub, we verify it exists in this Map.
//
// 💡 Why a Map and not a database?
// State values are short-lived (valid only for the ~60 seconds the user takes
// to complete the login on GitHub). Storing them in a DB would require a
// cleanup job. An in-memory Map is simpler and fast enough for most use cases.
//
// 💡 Production caveat:
// If you run multiple instances of the server (horizontal scaling), this
// Map would NOT be shared across instances — instance A generates the state,
// but instance B might handle the callback and not find it.
// Solution: replace with a Redis SET with a 5-minute TTL.
// For now, single-instance development, this is perfectly correct.

const pendingOAuthStates = new Map<string, number>(); // state → timestamp (ms)
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes


// ─────────────────────────────────────────────────────────────────────────────
// HANDLER 1: REDIRECT TO GITHUB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/github/redirect
 *
 * Flow: Frontend "Sign In" button hit → our server → GitHub login page
 *
 * 💡 Why does our server do the redirect instead of the frontend directly?
 * The frontend could construct the GitHub OAuth URL itself (CLIENT_ID is not
 * secret). However, routing through our server allows us to:
 *   1. Generate and store the CSRF `state` server-side (more trustworthy)
 *   2. Add consistent logging / rate limiting in one place
 *   3. Hide our OAuth config from client-side JavaScript bundles
 */
export async function redirectToGitHub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { url, state } = buildGitHubAuthUrl();

        // Store the state with a timestamp so we can expire stale entries
        pendingOAuthStates.set(state, Date.now());

        logger.info(`[AuthController] Initiating GitHub OAuth redirect. State: ${state.slice(0, 8)}...`);

        // HTTP 302 Temporary Redirect — tells the browser to navigate to `url`
        res.redirect(302, url);
    } catch (error) {
        next(error);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// HANDLER 2: OAUTH CALLBACK FROM GITHUB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/github/callback
 *
 * Flow: GitHub redirects here after user approves → we exchange code → issue JWT
 *
 * Query params sent by GitHub:
 *   - code:  One-time authorization code (expires in 10 minutes)
 *   - state: The state string we sent in the redirect (CSRF protection)
 *
 * On success, we redirect the user to the frontend dashboard with the JWT.
 * The frontend reads the JWT from the URL fragment and stores it securely.
 *
 * 💡 Why redirect with the token in the URL fragment (#)?
 * The URL fragment (everything after #) is NEVER sent to the server in HTTP
 * requests — it only exists in the browser. This means:
 *   - The JWT won't appear in server access logs
 *   - The JWT won't be sent to any intermediate proxy or CDN
 * This is the standard OAuth "Implicit Fragment" delivery pattern for SPAs.
 *
 * 💡 Production enhancement:
 * Use an HttpOnly cookie instead of a URL fragment. HttpOnly cookies can't be
 * read by JavaScript (XSS protection), and aren't exposed in the URL.
 * Requires CORS + SameSite=Strict configuration.
 */
export async function handleOAuthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { code, state, error } = req.query as Record<string, string>;

        // ── Case 1: User denied the authorization ────────────────────────
        // GitHub sends ?error=access_denied when user clicks "Cancel"
        if (error) {
            logger.warn(`[AuthController] GitHub OAuth denied by user. Error: ${error}`);
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=access_denied`);
            return;
        }

        // ── Case 2: Missing required parameters ───────────────────────────
        if (!code || !state) {
            logger.warn('[AuthController] Missing code or state in OAuth callback.');
            res.status(400).json({ error: 'Missing code or state parameter.' });
            return;
        }

        // ── Case 3: CSRF state validation ────────────────────────────────
        // Verify this state was generated by us and hasn't expired.
        const stateTimestamp = pendingOAuthStates.get(state);
        if (!stateTimestamp) {
            logger.warn(`[AuthController] OAuth state not found: ${state.slice(0, 8)}...`);
            res.status(400).json({ error: 'Invalid or expired OAuth state. Please try logging in again.' });
            return;
        }

        if (Date.now() - stateTimestamp > STATE_TTL_MS) {
            pendingOAuthStates.delete(state);
            logger.warn('[AuthController] OAuth state expired.');
            res.status(400).json({ error: 'OAuth state expired. Please try logging in again.' });
            return;
        }

        // State is valid — consume it (one-time use only)
        pendingOAuthStates.delete(state);

        // ── Case 4: Success path ───────────────────────────────────────────
        logger.info('[AuthController] OAuth state validated. Processing callback...');

        const sessionToken = await handleGitHubOAuthCallback(code);

        // Redirect the frontend to the dashboard with the token in the URL fragment.
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/success#token=${sessionToken}`);

    } catch (error) {
        next(error);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// HANDLER 3: VERIFY TOKEN (for frontend session checks)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 *
 * The frontend calls this on app load to check if the stored JWT is still valid.
 * If valid, returns the user's profile from the database.
 * If invalid or expired, returns 401.
 *
 * 💡 Why not just decode the JWT on the frontend?
 * The frontend CAN decode the payload (it's just base64), but it cannot VERIFY
 * the signature without the JWT_SECRET. Calling /me via the server ensures
 * the token is cryptographically valid AND the user still exists in our DB.
 */
export async function getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // The JWT is expected in the Authorization header: "Bearer <token>"
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing or malformed Authorization header.' });
            return;
        }

        const token = authHeader.slice(7); // Remove "Bearer " prefix

        // Verify and decode the JWT using our secret.
        // jwt.verify() throws TokenExpiredError or JsonWebTokenError if invalid.
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(token, process.env.JWT_SECRET) as { sub: string };

        // Fetch the user from the DB to ensure they still exist.
        // (They could have been deleted, or their session could have been revoked)
        const { prisma } = require('../config/db');
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
