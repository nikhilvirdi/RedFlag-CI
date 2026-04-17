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
 */

// Define the exact variables our app physically requires to boot securely.
const requiredVariables = ['DATABASE_URL', 'PORT', 'NODE_ENV'];

// Loop through each required variable and check if it exists
for (const envVar of requiredVariables) {
    if (!process.env[envVar]) {
        console.error(`🚨 FATAL ERROR: Missing required environment variable: ${envVar}`);
        process.exit(1); // Exits the Node runtime instantly with a "failure" code.
    }
}

// Export a strongly-typed object. 
// Now, other files can import `env.DATABASE_URL` without worrying if it is undefined.
export const env = {
    DATABASE_URL: process.env.DATABASE_URL as String,
    PORT: parseInt(process.env.PORT as string, 10),
    NODE_ENV: process.env.NODE_ENV as String,
};
