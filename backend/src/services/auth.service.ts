/**
 * Auth Service — GitHub OAuth 2.0 Flow
 * ───────────────────────────────────────
 *
 * This service handles everything related to authenticating a human user
 * (a developer) via their GitHub account for the web dashboard.
 *
 * ⚠️ IMPORTANT: This is completely separate from GitHub APP authentication.
 * ─────────────────────────────────────────────────────────────────────────
 * The system has TWO different authentication mechanisms — knowing which
 * is which is critical to understanding the codebase:
 *
 *   1. GitHub App Auth (in github.service.ts):
 *      - WHO: The RedFlag CI system itself
 *      - HOW: Signs a JWT with a PEM private key, exchanges it for an Installation Token
 *      - WHY: Allows the backend to call GitHub APIs on behalf of the installed app
 *             (fetch diffs, post comments, update commit status)
 *      - Used by: The webhook/scan pipeline. NEVER touches human user sessions.
 *
 *   2. GitHub OAuth 2.0 (THIS FILE):
 *      - WHO: A human developer using the web dashboard
 *      - HOW: Redirects the user to GitHub's login page, user approves, GitHub
 *             sends back a 'code', we exchange it for a user-level access token
 *      - WHY: Identifies WHO the human user is so we can show them their repos,
 *             their scan history, and personalized dashboard data
 *      - Used by: The auth controller. NEVER used in scan pipeline.
 *
 * 💡 What is OAuth 2.0?
 * ──────────────────────
 * OAuth 2.0 is an industry-standard authorization PROTOCOL (not authentication —
 * OAuth itself is about ACCESS, not identity). It defines a flow for a third-party
 * app (us) to get limited access to a user's account on another service (GitHub)
 * WITHOUT ever seeing the user's GitHub password.
 *
 * The "Authorization Code" flow we use here:
 *   Step 1: We redirect user → GitHub with our CLIENT_ID
 *   Step 2: GitHub shows its own login page, user logs in and clicks "Authorize"
 *   Step 3: GitHub redirects user back to OUR callback URL with a one-time `code`
 *   Step 4: Our backend exchanges that `code` for an `access_token` (server-to-server)
 *   Step 5: We use `access_token` to call GitHub API to get the user's profile
 *   Step 6: We save/update the user in our database and issue our own JWT session token
 *
 * 💡 Why issue a JWT instead of using GitHub's token as the session token?
 * ──────────────────────────────────────────────────────────────────────────
 * GitHub's access token never expires quickly and has broad scopes. If we sent
 * it to the browser and it leaked, an attacker could access the user's entire GitHub.
 * Our JWT:
 *   - Contains ONLY what we need: the user's internal database ID
 *   - Has a short expiry (e.g., 7 days)
 *   - Is signed with OUR secret — GitHub can't forge it
 *   - Can be invalidated server-side if the user logs out
 */

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** What GitHub returns when we exchange the code for a token */
interface GitHubTokenResponse {
    access_token: string;
    token_type: string;
    scope: string;
}

/** The subset of GitHub user profile data that we store */
interface GitHubUserProfile {
    id: number;         // GitHub's numeric user ID (stable, never changes even if username changes)
    login: string;      // Username (e.g., "nikhilvirdi")
    name: string | null;
    email: string | null;
    avatar_url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — GENERATE THE REDIRECT URL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the GitHub OAuth authorization URL the user will be redirected to.
 *
 * 💡 What is the `state` parameter?
 * The state is a random, unguessable string that we generate, save temporarily,
 * and send to GitHub. When GitHub redirects back, it echoes our state back.
 * We verify the returned state matches what we sent.
 *
 * This prevents CSRF (Cross-Site Request Forgery) attacks:
 * Without state, an attacker could craft a link to our /callback with their own
 * code and trick a logged-in user into linking the attacker's GitHub account.
 *
 * 💡 Why scope=read:user,user:email?
 * OAuth scopes limit what our app can do with the user's GitHub account.
 * - read:user → lets us fetch basic profile info (name, avatar, login)
 * - user:email → lets us fetch the user's primary email (may be private)
 * We deliberately request MINIMAL scopes — principle of least privilege.
 */
export function buildGitHubAuthUrl(): { url: string; state: string } {
    // Generate a cryptographically secure random state string.
    // 16 random bytes → 32 hex characters. More than enough to be unguessable.
    const state = require('crypto').randomBytes(16).toString('hex');

    const params = new URLSearchParams({
        client_id:    env.GITHUB_OAUTH_CLIENT_ID,
        redirect_uri: env.GITHUB_OAUTH_CALLBACK_URL,
        scope:        'read:user user:email',
        state,
    });

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
    return { url, state };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — EXCHANGE CODE FOR ACCESS TOKEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exchanges the one-time authorization code for a GitHub user access token.
 *
 * 💡 Why do this server-side and not directly from the browser?
 * The exchange requires our CLIENT_SECRET. If we did this from the browser,
 * the CLIENT_SECRET would be visible in DevTools network requests — compromising
 * our entire OAuth app. Server-side exchange keeps the secret hidden.
 *
 * 💡 Why does GitHub's token endpoint use application/x-www-form-urlencoded?
 * Older OAuth implementations predate JSON APIs. GitHub's token endpoint accepts
 * form-encoded data. The `Accept: application/json` header tells GitHub to
 * respond WITH json (instead of its old query-string format). This is quirky
 * but standard behavior for GitHub's legacy OAuth endpoint.
 */
async function exchangeCodeForToken(code: string): Promise<string> {
    const response = await axios.post<GitHubTokenResponse>(
        'https://github.com/login/oauth/access_token',
        {
            client_id:     env.GITHUB_OAUTH_CLIENT_ID,
            client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
            code,
            redirect_uri:  env.GITHUB_OAUTH_CALLBACK_URL,
        },
        {
            headers: { Accept: 'application/json' },
        }
    );

    if (!response.data.access_token) {
        throw new Error(`GitHub OAuth token exchange failed: ${JSON.stringify(response.data)}`);
    }

    return response.data.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — FETCH USER PROFILE FROM GITHUB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uses the GitHub access token to call the /user API and get the user's profile.
 */
async function fetchGitHubUserProfile(accessToken: string): Promise<GitHubUserProfile> {
    const response = await axios.get<GitHubUserProfile>('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
        },
    });
    return response.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — UPSERT USER IN DATABASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the user in our database if they're logging in for the first time,
 * or updates their profile if they already exist.
 *
 * 💡 What is "upsert"?
 * "Upsert" = UPDATE if exists, INSERT if not. It's a single database operation
 * (not a manual SELECT → IF exists → UPDATE else INSERT) which avoids a
 * race condition where two simultaneous logins could both try to INSERT the
 * same user. Prisma's upsert compiles to a single atomic SQL statement:
 *   INSERT ... ON CONFLICT (githubId) DO UPDATE SET ...
 *
 * 💡 Why use GitHub's numeric `id` as our `githubId` instead of `login`?
 * GitHub allows users to change their username (`login`). If we stored
 * "nikhilvirdi" as the identifier and the user renames to "nikhil_virdi",
 * they'd appear as a new user. GitHub's numeric ID is permanent and immutable.
 */
async function upsertUser(profile: GitHubUserProfile) {
    return prisma.user.upsert({
        where:  { githubId: String(profile.id) },
        create: {
            githubId:  String(profile.id),
            email:     profile.email,
            name:      profile.name,
            avatarUrl: profile.avatar_url,
        },
        update: {
            // On subsequent logins, keep their profile data fresh.
            // A user might change their name, avatar, or make their email public.
            email:     profile.email,
            name:      profile.name,
            avatarUrl: profile.avatar_url,
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — MINT OUR OWN JWT SESSION TOKEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Issues a signed JWT that the frontend will store (in an HttpOnly cookie or
 * localStorage) and send with every subsequent API request.
 *
 * 💡 What is a JWT (JSON Web Token)?
 * A JWT is a compact, URL-safe token with 3 base64-encoded parts:
 *   Header.Payload.Signature
 *
 *   Header:    { "alg": "HS256", "typ": "JWT" }
 *   Payload:   { "sub": "user-uuid", "iat": 1234567890, "exp": 1235467890 }
 *   Signature: HMAC_SHA256(header + "." + payload, JWT_SECRET)
 *
 * The SIGNATURE is what makes it tamper-proof. If anyone modifies the payload
 * (e.g., changes sub to another user's ID), the signature won't match our
 * secret and we'll reject it.
 *
 * 💡 What to put in the payload (claims)?
 * ONLY what's needed for stateless auth: the user's internal DB id.
 * Never put passwords, emails, or sensitive data in JWT payloads —
 * they're only base64 encoded (not encrypted), so anyone can decode them.
 * The signature only prevents TAMPERING, not READING.
 */
function mintSessionToken(userId: string): string {
    return jwt.sign(
        { sub: userId },          // 'sub' (subject) = who this token is for
        env.JWT_SECRET,           // HMAC-SHA256 signing key
        { expiresIn: '7d' }       // Token expires in 7 days — user must re-login
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORTED FUNCTION — THE FULL OAUTH CALLBACK HANDLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orchestrates the full OAuth callback: code → token → profile → upsert → JWT.
 *
 * Called by the auth controller when GitHub redirects back to /api/auth/callback.
 * Returns a signed session JWT on success.
 */
export async function handleGitHubOAuthCallback(code: string): Promise<string> {
    logger.info('[AuthService] Starting GitHub OAuth callback flow...');

    // Step 1: Exchange the one-time code for a GitHub access token (server-to-server)
    const accessToken = await exchangeCodeForToken(code);
    logger.info('[AuthService] GitHub access token obtained.');

    // Step 2: Use the access token to get the user's GitHub profile
    const profile = await fetchGitHubUserProfile(accessToken);
    logger.info(`[AuthService] GitHub profile fetched for user: ${profile.login} (id: ${profile.id})`);

    // Step 3: Upsert the user into our PostgreSQL database
    const user = await upsertUser(profile);
    logger.info(`[AuthService] User upserted in database. Internal ID: ${user.id}`);

    // Step 4: Mint and return our own JWT session token
    const sessionToken = mintSessionToken(user.id);
    logger.info('[AuthService] Session JWT minted. OAuth flow complete.');

    return sessionToken;
}
