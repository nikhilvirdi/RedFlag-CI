import winston from 'winston';
import { env } from '../config/env';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level}: ${message}`;
  })
);

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console(),
  ],
});
