import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import {
    getDashboardStatsHandler,
    getRepositoriesHandler,
    getRepositoryHandler,
    getScanResultsHandler,
    getScanResultDetailHandler,
    rescanRepositoryHandler,
    getPostureHandler,
    getRiskTrendHandler,
    getAiImpactHandler,
    getSecurityDebtHandler,
} from '../controllers/dashboard.controller';

const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/stats', getDashboardStatsHandler);
dashboardRouter.get('/repositories', getRepositoriesHandler);
dashboardRouter.get('/repositories/:repositoryId', getRepositoryHandler);
dashboardRouter.get('/repositories/:repositoryId/posture', getPostureHandler);
dashboardRouter.get('/repositories/:repositoryId/risk-trend', getRiskTrendHandler);
dashboardRouter.get('/repositories/:repositoryId/ai-impact', getAiImpactHandler);
dashboardRouter.get('/repositories/:repositoryId/security-debt', getSecurityDebtHandler);
dashboardRouter.get('/repositories/:repositoryId/scans', getScanResultsHandler);
dashboardRouter.get('/scans/:scanResultId', getScanResultDetailHandler);
dashboardRouter.post('/repositories/:repositoryId/rescan', rescanRepositoryHandler);

export { dashboardRouter };
