import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import {
    getDashboardStatsHandler,
    getRepositoriesHandler,
    getRepositoryHandler,
    getScanResultsHandler,
    getScanResultDetailHandler,
    rescanRepositoryHandler,
} from '../controllers/dashboard.controller';

const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/stats', getDashboardStatsHandler);
dashboardRouter.get('/repositories', getRepositoriesHandler);
dashboardRouter.get('/repositories/:repositoryId', getRepositoryHandler);
dashboardRouter.get('/repositories/:repositoryId/scans', getScanResultsHandler);
dashboardRouter.get('/scans/:scanResultId', getScanResultDetailHandler);
dashboardRouter.post('/repositories/:repositoryId/rescan', rescanRepositoryHandler);

export { dashboardRouter };
