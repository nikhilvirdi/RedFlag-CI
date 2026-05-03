import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`[Unhandled Error]: ${err.message}`);

  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: 'Internal Server Error',
    details: isProduction ? undefined : err.message
  });
};
