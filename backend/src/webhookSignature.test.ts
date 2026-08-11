import { createHmac } from 'crypto';
import { verifyWebhookSignature } from './webhookSignature';

const SECRET = 'test-secret';
const PAYLOAD = Buffer.from(JSON.stringify({ action: 'opened' }));

function sign(payload: Buffer, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

describe('verifyWebhookSignature', () => {
  it('returns true for a valid signature', () => {
    expect(verifyWebhookSignature(PAYLOAD, sign(PAYLOAD, SECRET), SECRET)).toBe(true);
  });

  it('returns false when the header is missing', () => {
    expect(verifyWebhookSignature(PAYLOAD, undefined, SECRET)).toBe(false);
  });

  it('returns false when the header lacks the sha256= prefix', () => {
    const rawHex = createHmac('sha256', SECRET).update(PAYLOAD).digest('hex');
    expect(verifyWebhookSignature(PAYLOAD, rawHex, SECRET)).toBe(false);
  });

  it('returns false, without throwing, for a same-length wrong value', () => {
    expect(verifyWebhookSignature(PAYLOAD, sign(PAYLOAD, 'wrong-secret'), SECRET)).toBe(false);
  });

  it('returns false, without throwing, for a header shorter than the expected signature', () => {
    expect(() =>
      verifyWebhookSignature(PAYLOAD, 'sha256=abc', SECRET)
    ).not.toThrow();
    expect(verifyWebhookSignature(PAYLOAD, 'sha256=abc', SECRET)).toBe(false);
  });

  it('returns false, without throwing, for a header longer than the expected signature', () => {
    const tooLong = sign(PAYLOAD, SECRET) + 'ff';
    expect(() => verifyWebhookSignature(PAYLOAD, tooLong, SECRET)).not.toThrow();
    expect(verifyWebhookSignature(PAYLOAD, tooLong, SECRET)).toBe(false);
  });
});
