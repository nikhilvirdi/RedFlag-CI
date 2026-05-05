import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import {
    createIgnoreRuleHandler,
    listIgnoreRulesHandler,
    deleteIgnoreRuleHandler,
} from '../controllers/ignoreRules.controller';

export const ignoreRulesRouter = Router();

ignoreRulesRouter.use(authenticate);

ignoreRulesRouter.post('/', createIgnoreRuleHandler);
ignoreRulesRouter.get('/', listIgnoreRulesHandler);
ignoreRulesRouter.delete('/:id', deleteIgnoreRuleHandler);
