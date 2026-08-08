import { createHmac } from 'crypto';
import { Express } from 'express';
import request from 'supertest';
import { createApp } from './app';
import { GitHubApp } from './githubApp';
import { processPullRequestEvent } from './processPullRequestEvent';
import { logger } from './logger';

jest.mock('./processPullRequestEvent');
const mockProcessPullRequestEvent = processPullRequestEvent as jest.MockedFunction<
  typeof processPullRequestEvent
>;

jest.mock('./logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
const mockLogger = logger as unknown as { warn: jest.Mock; error: jest.Mock };

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
  mockLogger.warn.mockReset();
  mockLogger.error.mockReset();
});

function rateLimitError(status: 403 | 429): Error & { status: number } {
  return Object.assign(new Error('You have exceeded a secondary rate limit'), { status });
}

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

describe('Task 6.3: rate-limit failures are logged as a distinct condition', () => {
  let app: Express;

  beforeEach(() => {
    const githubApp = { getInstallationOctokit: jest.fn() } as unknown as GitHubApp;
    app = createApp(githubApp);
  });

  it('logs a distinct warning, not the generic error path, when a 403 rate-limit error survives to the webhook handler', async () => {
    mockProcessPullRequestEvent.mockRejectedValueOnce(rateLimitError(403));

    const response = await send(app, 'delivery-403');

    expect(response.status).toBe(200);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('rate limit'),
      expect.objectContaining({ message: expect.stringContaining('secondary rate limit') })
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('logs a distinct warning for a 429 too', async () => {
    mockProcessPullRequestEvent.mockRejectedValueOnce(rateLimitError(429));

    const response = await send(app, 'delivery-429');

    expect(response.status).toBe(200);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('still logs an ordinary error (not a rate-limit warning) for a non-rate-limit failure, e.g. malformed webhook JSON', async () => {
    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign('not valid json', WEBHOOK_SECRET))
      .send('not valid json');

    expect(response.status).toBe(200);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing webhook event',
      expect.objectContaining({ message: expect.any(String) })
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockProcessPullRequestEvent).not.toHaveBeenCalled();
  });

  it('still logs an ordinary error for a generic (non-403/429) failure from the pipeline', async () => {
    mockProcessPullRequestEvent.mockRejectedValueOnce(new Error('boom'));

    const response = await send(app, 'delivery-generic-error');

    expect(response.status).toBe(200);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
