import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import { createWebhookHandler, listWebhooksHandler, deleteWebhookHandler } from '../controllers/outboundWebhook.controller';

const outboundWebhookRouter = Router();

outboundWebhookRouter.use(authenticate);

outboundWebhookRouter.post('/', createWebhookHandler);
outboundWebhookRouter.get('/', listWebhooksHandler);
outboundWebhookRouter.delete('/:id', deleteWebhookHandler);

export { outboundWebhookRouter };
