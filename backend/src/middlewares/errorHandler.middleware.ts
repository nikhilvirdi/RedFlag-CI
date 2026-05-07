import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (err: Error & { statusCode?: number }, req: Request, res: Response, _next: NextFunction) => {
  logger.error(`[Unhandled Error]: ${err.message}`);

  const statusCode = err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    details: isProduction || statusCode !== 500 ? undefined : err.message
  });
};
