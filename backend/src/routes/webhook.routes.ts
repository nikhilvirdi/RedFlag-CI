import { Router } from 'express';
import { handleGithubWebhook } from '../controllers/webhook.controller';
import { verifyGithubSignature } from '../middlewares/verifyGithubSignature.middleware';

export const webhookRouter = Router();

webhookRouter.post('/', verifyGithubSignature, handleGithubWebhook);
