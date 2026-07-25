import { createHmac } from 'crypto';
import { Express } from 'express';
import request from 'supertest';
import { createApp } from './app';

const WEBHOOK_SECRET = 'test-secret';
const payload = JSON.stringify({ action: 'opened' });

function sign(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('POST /webhook', () => {
  let app: Express;

  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
    app = createApp();
  });

  it('returns 200 for a request with a valid signature', async () => {
    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign(payload, WEBHOOK_SECRET))
      .send(payload);

    expect(response.status).toBe(200);
  });

  it('returns 401 for a request with an invalid signature', async () => {
    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign(payload, 'wrong-secret'))
      .send(payload);

    expect(response.status).toBe(401);
  });

  it('returns 401 for a request with no signature header', async () => {
    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(401);
  });
});
