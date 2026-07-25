import { createHmac, timingSafeEqual } from 'crypto';

const SIGNATURE_PREFIX = 'sha256=';

export function verifyWebhookSignature(
  payload: Buffer,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');
  const expected = Buffer.from(SIGNATURE_PREFIX + expectedSignature, 'utf8');
  const provided = Buffer.from(signatureHeader, 'utf8');

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}
