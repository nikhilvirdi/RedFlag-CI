import express, { Express } from 'express';
import { getWebhookSecret } from './config';
import { verifyWebhookSignature } from './webhookSignature';
import { GitHubApp } from './githubApp';
import { processPullRequestEvent } from './processPullRequestEvent';

export function createApp(githubApp: GitHubApp): Express {
  const app = express();
  const webhookSecret = getWebhookSecret();

  app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.header('x-hub-signature-256');
    const payload = req.body;

    if (!Buffer.isBuffer(payload) || !verifyWebhookSignature(payload, signature, webhookSecret)) {
      res.sendStatus(401);
      return;
    }

    try {
      const event: unknown = JSON.parse(payload.toString('utf-8'));
      await processPullRequestEvent(githubApp, event);
    } catch (error) {
      console.error('Error processing webhook event:', error);
    }

    res.sendStatus(200);
  });

  return app;
}
