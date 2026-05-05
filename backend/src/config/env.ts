import dotenv from 'dotenv';

dotenv.config();

const requiredVariables = [
    'DATABASE_URL',
    'PORT',
    'NODE_ENV',
    'GITHUB_APP_ID',
    'GITHUB_WEBHOOK_SECRET',
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_OAUTH_CLIENT_ID',
    'GITHUB_OAUTH_CLIENT_SECRET',
    'GITHUB_OAUTH_CALLBACK_URL',
    'JWT_SECRET',
    'REDIS_HOST',
    'REDIS_PORT',
    'ANTHROPIC_API_KEY',
];

for (const envVar of requiredVariables) {
    if (!process.env[envVar]) {
        console.error(`FATAL ERROR: Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

export const env = {
    DATABASE_URL: process.env.DATABASE_URL as string,
    PORT: parseInt(process.env.PORT as string, 10),
    NODE_ENV: process.env.NODE_ENV as string,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID as string,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET as string,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY as string,
    GITHUB_OAUTH_CLIENT_ID: process.env.GITHUB_OAUTH_CLIENT_ID as string,
    GITHUB_OAUTH_CLIENT_SECRET: process.env.GITHUB_OAUTH_CLIENT_SECRET as string,
    GITHUB_OAUTH_CALLBACK_URL: process.env.GITHUB_OAUTH_CALLBACK_URL as string,
    JWT_SECRET: process.env.JWT_SECRET as string,
    REDIS_HOST: process.env.REDIS_HOST as string,
    REDIS_PORT: parseInt(process.env.REDIS_PORT as string, 10),
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY as string,
};
