import dotenv from 'dotenv';

// Load the environment variables from the .env file into process.env
dotenv.config();

/**
 * 💡 The Intuition for Env Validation:
 * In a beginner app, devs scatter `process.env.DATABASE_URL` across 50 files.
 * If the variable is missing, the app continues running until it randomly hits one of those files and crashes.
 * 
 * In a production app, we centralize and validate ALL variables here during server startup.
 * If something is missing, the server throws a fatal error immediately on boot, preventing broken code from going live.
 *
 * 💡 Why process.exit(1)?
 * Exit code 1 is the Unix standard for "failure". Docker, Kubernetes, and systemd
 * watch for a non-zero exit code and restart the process, which alerts on-call
 * engineers via monitoring tools. Exit code 0 means "success" — don't use that here.
 */

// ─────────────────────────────────────────────────────────────────────────────
// REQUIRED VARIABLES
// Add any new required variables here. If they're missing at startup, the
// server crashes immediately with a clear message — no silent failures ever.
// ─────────────────────────────────────────────────────────────────────────────
const requiredVariables = [
    // Core infrastructure
    'DATABASE_URL',
    'PORT',
    'NODE_ENV',
    // GitHub App (for webhook scanning pipeline)
    'GITHUB_APP_ID',
    'GITHUB_WEBHOOK_SECRET',
    'GITHUB_APP_PRIVATE_KEY',
    // GitHub OAuth (for dashboard user login)
    'GITHUB_OAUTH_CLIENT_ID',
    'GITHUB_OAUTH_CLIENT_SECRET',
    'GITHUB_OAUTH_CALLBACK_URL',
    // Session security
    'JWT_SECRET',
];

for (const envVar of requiredVariables) {
    if (!process.env[envVar]) {
        console.error(`🚨 FATAL ERROR: Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// STRONGLY-TYPED EXPORT
// ─────────────────────────────────────────────────────────────────────────────
// Using `as string` (not String) because TypeScript's primitive `string` type
// is what all string functions expect. The boxed `String` object type causes
// subtle type errors in comparisons and third-party library calls.
export const env = {
    // Core
    DATABASE_URL: process.env.DATABASE_URL as string,
    PORT:         parseInt(process.env.PORT as string, 10),
    NODE_ENV:     process.env.NODE_ENV as string,
    // GitHub App
    GITHUB_APP_ID:        process.env.GITHUB_APP_ID as string,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET as string,
    GITHUB_APP_PRIVATE_KEY:    process.env.GITHUB_APP_PRIVATE_KEY as string,
    // GitHub OAuth
    GITHUB_OAUTH_CLIENT_ID:     process.env.GITHUB_OAUTH_CLIENT_ID as string,
    GITHUB_OAUTH_CLIENT_SECRET: process.env.GITHUB_OAUTH_CLIENT_SECRET as string,
    GITHUB_OAUTH_CALLBACK_URL:  process.env.GITHUB_OAUTH_CALLBACK_URL as string,
    // JWT
    JWT_SECRET: process.env.JWT_SECRET as string,
};
