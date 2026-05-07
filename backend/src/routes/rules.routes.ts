import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import { listRulesHandler, suggestRuleHandler, listSuggestionsHandler, approveSuggestionHandler, rejectSuggestionHandler } from '../controllers/rules.controller';

const rulesRouter = Router();

rulesRouter.get('/', listRulesHandler);

rulesRouter.post('/suggest', authenticate, suggestRuleHandler);
rulesRouter.get('/suggestions', authenticate, listSuggestionsHandler);
rulesRouter.patch('/suggestions/:id/approve', authenticate, approveSuggestionHandler);
rulesRouter.patch('/suggestions/:id/reject', authenticate, rejectSuggestionHandler);

export { rulesRouter };
