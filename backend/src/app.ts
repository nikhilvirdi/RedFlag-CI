import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { webhookRouter } from './routes/webhook.routes';
import { logger } from './utils/logger';

/**
 * 💡 Why separate `app.ts` from `index.ts`?
 * In production-grade systems, we separate the *creation* of the Express app from the *server listening*.
 * This allows us to easily import `app` into our Jest testing framework without starting the physical server port,
 * which prevents "Port already in use" errors during test runs.
 */

const app: Application = express();

// GLOBAL MIDDLEWARES

// Helmet sets HTTP headers that protect your app from common vulnerabilities (e.g., cross-site scripting).
app.use(helmet());

// CORS allows your Next.js dashboard (running on a different port/domain) to communicate with this API.
app.use(cors());

// Morgan is an HTTP request logger. 'dev' format provides colored logs in the terminal.
// E.g., it will output: GET /healthcheck 200 4.312 ms - 25
app.use(morgan('dev'));

// Express.json() with rawBody capture.
// The HMAC signature verification middleware requires the ORIGINAL raw bytes of the request body.
// express.json() by default discards the raw buffer after parsing. The `verify` callback fires
// before parsing and lets us stash the raw buffer onto req for use in our middleware.
app.use(express.json({
    verify: (req: Request, _res, buf) => {
        (req as any).rawBody = buf;
    }
}));


// ROUTES

// A basic health check route to verify our server is running.
// Standard practice for load balancers (or NGINX) to check if your API is alive.
app.get('/healthcheck', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'RedFlag CI Backend is running securely.' });
});

// We attach modular routers here:
app.use('/api/webhooks', webhookRouter);


// GLOBAL ERROR HANDLING

// If a request bypasses all routes above, it hits this 404 handler.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error-handling middleware. Any `next(error)` call will route to this block.
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`[Unhandled Error]: ${err.message}`);

  // Never leak internal stack traces to the client in production!
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: 'Internal Server Error',
    details: isProduction ? undefined : err.message
  });
});

export default app;
