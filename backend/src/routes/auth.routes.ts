/**
 * Auth Routes
 * ────────────
 *
 * Binds HTTP method + path pairs to their controller handlers.
 * This is the route manifest for the authentication subsystem.
 *
 * Registered in app.ts under the '/api/auth' prefix, so:
 *   /github/redirect → GET /api/auth/github/redirect
 *   /github/callback → GET /api/auth/github/callback
 *   /me              → GET /api/auth/me
 *
 * 💡 Why a separate router file instead of defining routes in app.ts?
 * Express Router is an isolated mini-application that has its own middleware
 * and routing stack. By splitting into feature routers (auth, webhook, etc.),
 * we keep app.ts clean and focused purely on mounting sub-applications.
 * Each router can evolve independently — adding rate limiting to auth routes
 * doesn't affect the webhook router.
 */

import { Router } from 'express';
import {
    redirectToGitHub,
    handleOAuthCallback,
    getCurrentUser,
} from '../controllers/auth.controller';

const authRouter = Router();

// ── OAuth Initiation ──────────────────────────────────────────────────────────
// Frontend's "Sign in with GitHub" button links to this route.
// Our server generates the OAuth URL (with CSRF state) and issues the redirect.
authRouter.get('/github/redirect', redirectToGitHub);

// ── OAuth Callback ────────────────────────────────────────────────────────────
// GitHub redirects here after user approves/denies authorization.
// Registered as the "callback URL" in the GitHub OAuth App settings.
authRouter.get('/github/callback', handleOAuthCallback);

// ── Session Verification ──────────────────────────────────────────────────────
// Frontend calls this on app load to validate a stored JWT and get user profile.
// Protected: requires a valid JWT in Authorization: Bearer <token> header.
authRouter.get('/me', getCurrentUser);

export { authRouter };
