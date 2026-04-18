import { Router } from 'express';
import { handleGithubWebhook } from '../controllers/webhook.controller';
import { verifyGithubSignature } from '../middlewares/verifyGithubSignature.middleware';

// Initialize a clean, modular router just for Webhooks.
export const webhookRouter = Router();

// Route: POST /api/webhooks/github
// Request flow: verifyGithubSignature → handleGithubWebhook
// The signature middleware acts as a locked gate — only cryptographically
// authenticated GitHub payloads ever reach the controller.
webhookRouter.post('/github', verifyGithubSignature, handleGithubWebhook);
