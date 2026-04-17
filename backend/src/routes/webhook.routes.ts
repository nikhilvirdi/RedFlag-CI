import { Router } from 'express';
import { handleGithubWebhook } from '../controllers/webhook.controller';

// Initialize a clean, modular router just for Webhooks.
export const webhookRouter = Router();

/**
 * 💡 Production Practice: RESTful Naming
 * We don't route to `/api/webhooks/handleGithub`. We route to `/api/webhooks/github` 
 * and let the POST method strictly imply the action.
 */

// Route: POST /api/webhooks/github
webhookRouter.post('/github', handleGithubWebhook);
