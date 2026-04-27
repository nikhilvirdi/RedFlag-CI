import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Error Handling Middleware
 * 
 * Purpose: Centralized location to catch ANY errors thrown anywhere in the app.
 * Instead of crashing the server, this middleware will format the error nicely,
 * log it via our logger, and send a clean 500/400 response back to the client.
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`[Unhandled Error]: ${err.message}`);

  // Never leak internal stack traces to the client in production!
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: 'Internal Server Error',
    details: isProduction ? undefined : err.message
  });
};
