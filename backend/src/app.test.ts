import { createHmac } from 'crypto';
import { Express } from 'express';
import request from 'supertest';
import { createApp } from './app';
import { GitHubApp } from './githubApp';
import { processPullRequestEvent } from './processPullRequestEvent';

jest.mock('./processPullRequestEvent');
const mockProcessPullRequestEvent = processPullRequestEvent as jest.MockedFunction<
  typeof processPullRequestEvent
>;

const WEBHOOK_SECRET = 'test-secret';
const payload = JSON.stringify({ action: 'opened' });

function sign(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function send(app: Express, deliveryId?: string) {
  const req = request(app)
    .post('/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Hub-Signature-256', sign(payload, WEBHOOK_SECRET));
  if (deliveryId) {
    req.set('X-GitHub-Delivery', deliveryId);
  }
  return req.send(payload);
}

beforeAll(() => {
  process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

beforeEach(() => {
  mockProcessPullRequestEvent.mockReset().mockResolvedValue(undefined);
});

describe('POST /webhook', () => {
  let app: Express;

  beforeAll(() => {
    const githubApp = { getInstallationOctokit: jest.fn() } as unknown as GitHubApp;
    app = createApp(githubApp);
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

describe('Task 6.2: webhook delivery deduplication', () => {
  let app: Express;

  beforeEach(() => {
    const githubApp = { getInstallationOctokit: jest.fn() } as unknown as GitHubApp;
    app = createApp(githubApp);
  });

  it('processes a delivery only once when the same X-GitHub-Delivery header is sent twice', async () => {
    const first = await send(app, 'delivery-1');
    const second = await send(app, 'delivery-1');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockProcessPullRequestEvent).toHaveBeenCalledTimes(1);
  });

  it('processes deliveries independently when the X-GitHub-Delivery header differs', async () => {
    const first = await send(app, 'delivery-a');
    const second = await send(app, 'delivery-b');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockProcessPullRequestEvent).toHaveBeenCalledTimes(2);
  });

  it('processes every request when no X-GitHub-Delivery header is present, matching prior behavior', async () => {
    await send(app);
    await send(app);

    expect(mockProcessPullRequestEvent).toHaveBeenCalledTimes(2);
  });

  it('gives each app instance its own dedup store, so a delivery ID reused across two apps is not treated as a duplicate', async () => {
    const githubApp = { getInstallationOctokit: jest.fn() } as unknown as GitHubApp;
    const otherApp = createApp(githubApp);

    await send(app, 'shared-id');
    await send(otherApp, 'shared-id');

    expect(mockProcessPullRequestEvent).toHaveBeenCalledTimes(2);
  });

  it('still returns 401 and never calls processPullRequestEvent for a duplicate-looking but invalid signature', async () => {
    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign(payload, 'wrong-secret'))
      .set('X-GitHub-Delivery', 'delivery-invalid')
      .send(payload);

    expect(response.status).toBe(401);
    expect(mockProcessPullRequestEvent).not.toHaveBeenCalled();
  });
});
