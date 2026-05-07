import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { webhookRouter } from './routes/webhook.routes';
import { authRouter } from './routes/auth.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { ignoreRulesRouter } from './routes/ignoreRules.routes';
import { notificationRouter } from './routes/notification.routes';
import { outboundWebhookRouter } from './routes/outboundWebhook.routes';
import { rulesRouter } from './routes/rules.routes';
import { auditRouter } from './routes/audit.routes';
import { badgeRouter } from './routes/badge.routes';
import { logger } from './utils/logger';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { globalRateLimiter, authRateLimiter, webhookRateLimiter, badgeRateLimiter } from './middlewares/rateLimit.middleware';
import { enforceApiQuota } from './middlewares/quota.middleware';

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

app.use(express.json({
    verify: (req: Request, _res, buf) => {
        (req as any).rawBody = buf;
    }
}));

app.get('/healthcheck', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'RedFlag CI Backend is running securely.' });
});

app.use('/api/webhooks', webhookRateLimiter, webhookRouter);
app.use('/api/auth', authRateLimiter, authRouter);
app.use('/api/dashboard', globalRateLimiter, enforceApiQuota, dashboardRouter);
app.use('/api/ignore-rules', globalRateLimiter, enforceApiQuota, ignoreRulesRouter);
app.use('/api/notifications', globalRateLimiter, enforceApiQuota, notificationRouter);
app.use('/api/outbound-webhooks', globalRateLimiter, enforceApiQuota, outboundWebhookRouter);
app.use('/api/rules', globalRateLimiter, rulesRouter);
app.use('/api/audit-log', globalRateLimiter, enforceApiQuota, auditRouter);
app.use('/api/badge', badgeRateLimiter, badgeRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

export default app;
