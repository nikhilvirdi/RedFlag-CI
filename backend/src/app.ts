import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { webhookRouter } from './routes/webhook.routes';
import { authRouter } from './routes/auth.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { ignoreRulesRouter } from './routes/ignoreRules.routes';
import { logger } from './utils/logger';
import { errorHandler } from './middlewares/errorHandler.middleware';

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

app.use('/api/webhooks', webhookRouter);
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ignore-rules', ignoreRulesRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

export default app;
