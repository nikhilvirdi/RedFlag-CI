import express, { Express } from 'express';
import { getWebhookSecret } from './config';
import { verifyWebhookSignature } from './webhookSignature';

export function createApp(): Express {
  const app = express();
  const webhookSecret = getWebhookSecret();

  app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const signature = req.header('x-hub-signature-256');
    const payload = req.body;

    if (!Buffer.isBuffer(payload) || !verifyWebhookSignature(payload, signature, webhookSecret)) {
      res.sendStatus(401);
      return;
    }

    res.sendStatus(200);
  });

  return app;
}
