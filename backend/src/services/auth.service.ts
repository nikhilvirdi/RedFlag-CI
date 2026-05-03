import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface GitHubTokenResponse {
    access_token: string;
    token_type: string;
    scope: string;
}

interface GitHubUserProfile {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
}

export function buildGitHubAuthUrl(): { url: string; state: string } {
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

async function fetchGitHubUserProfile(accessToken: string): Promise<GitHubUserProfile> {
    const response = await axios.get<GitHubUserProfile>('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
        },
    });
    return response.data;
}

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
            email:     profile.email,
            name:      profile.name,
            avatarUrl: profile.avatar_url,
        },
    });
}

function mintSessionToken(userId: string): string {
    return jwt.sign(
        { sub: userId },
        env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export async function handleGitHubOAuthCallback(code: string): Promise<string> {
    logger.info('[AuthService] Starting GitHub OAuth callback flow...');

    const accessToken = await exchangeCodeForToken(code);
    logger.info('[AuthService] GitHub access token obtained.');

    const profile = await fetchGitHubUserProfile(accessToken);
    logger.info(`[AuthService] GitHub profile fetched for user: ${profile.login} (id: ${profile.id})`);

    const user = await upsertUser(profile);
    logger.info(`[AuthService] User upserted in database. Internal ID: ${user.id}`);

    const sessionToken = mintSessionToken(user.id);
    logger.info('[AuthService] Session JWT minted. OAuth flow complete.');

    return sessionToken;
}
