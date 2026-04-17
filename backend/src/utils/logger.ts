import winston from 'winston';
import { env } from '../config/env';

/**
 * 💡 The Intuition for Winston vs console.log:
 * 
 * 1. `console.log` cannot be filtered. If you log 1,000 things, your terminal is flooded.
 * 2. In production, we don't want to print out debugging secrets to the terminal.
 * 3. Winston allows "Log Levels" (error, warn, info, debug).
 *    If NODE_ENV is set to "production", we can tell Winston to ONLY print "error", ignoring "debug".
 */

// Define a custom formatting structure for our logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(), // Adds nice colors to the terminal (e.g., red for errors)
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level}: ${message}`;
  })
);

// Create the logger instance
export const logger = winston.createLogger({
  // If we are in dev, show everything down to 'debug'. If in prod, only show 'info' and above.
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    // A "transport" is a destination for the logs. Here we send them to the Console (terminal).
    // In the future, we could add a File transport: `new winston.transports.File({ filename: 'error.log' })`
    new winston.transports.Console(),
  ],
});
