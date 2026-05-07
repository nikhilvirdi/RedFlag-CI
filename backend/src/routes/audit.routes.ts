import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import { getAuditLogsHandler } from '../controllers/audit.controller';

const auditRouter = Router();

auditRouter.use(authenticate);

auditRouter.get('/', getAuditLogsHandler);

export { auditRouter };
