import express, { Express } from 'express';
import { getWebhookSecret } from './config';
import { verifyWebhookSignature } from './webhookSignature';
import { GitHubApp } from './githubApp';
import { processPullRequestEvent } from './processPullRequestEvent';

// GitHub retries a webhook delivery on timeout/failure using the same
// X-GitHub-Delivery header, so a retry must not reprocess the event -- since
// Task 6.1, a silent double-run would just re-edit the same comment/check
// run instead of visibly duplicating it, making the bug quieter and easier
// to miss. Tracked in memory, bounded to the last MAX_TRACKED_DELIVERIES
// ids: this is a stateless service (architecture.md section 2), so a
// restart resets dedup state and a delivery from just before restart could
// theoretically reprocess. That's an accepted gap for v1.2.0, not a defect
// -- durable dedup would need persistence, which is explicitly out of scope
// until v2 (architecture.md section 8).
const MAX_TRACKED_DELIVERIES = 1000;

function markSeen(seenDeliveryIds: Map<string, true>, deliveryId: string): boolean {
  if (seenDeliveryIds.has(deliveryId)) {
    return true;
  }
  seenDeliveryIds.set(deliveryId, true);
  if (seenDeliveryIds.size > MAX_TRACKED_DELIVERIES) {
    const oldest = seenDeliveryIds.keys().next().value as string;
    seenDeliveryIds.delete(oldest);
  }
  return false;
}

export function createApp(githubApp: GitHubApp): Express {
  const app = express();
  const webhookSecret = getWebhookSecret();
  const seenDeliveryIds = new Map<string, true>();

  app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.header('x-hub-signature-256');
    const payload = req.body;

    if (!Buffer.isBuffer(payload) || !verifyWebhookSignature(payload, signature, webhookSecret)) {
      res.sendStatus(401);
      return;
    }

    const deliveryId = req.header('x-github-delivery');
    if (deliveryId && markSeen(seenDeliveryIds, deliveryId)) {
      res.sendStatus(200);
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
