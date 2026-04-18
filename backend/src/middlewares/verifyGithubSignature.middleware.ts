import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

// WEBHOOK SIGNATURE VERIFICATION MIDDLEWARE
//
// Theory — The Attack Vector We Are Preventing:
// Our webhook endpoint at POST /api/webhooks/github is publicly accessible on the internet.
// Without verification, any attacker can send a fake JSON payload impersonating GitHub:
//   { "action": "opened", "repository": { "full_name": "victim/repo" }, ... }
// This would trigger our scan worker to process fraudulent data, wasting compute resources
// and potentially being used to probe our system internals.
//
// The Solution — HMAC-SHA256 Shared Secret:
// When we register our GitHub App, we provide GitHub with a secret string.
// GitHub stores this secret. Before sending ANY webhook, GitHub:
//   1. Takes the raw request body bytes
//   2. Runs HMAC-SHA256 over them using our secret as the key
//   3. Attaches the resulting signature as the `x-hub-signature-256` header
//
// On our side, we perform the EXACT SAME computation independently.
// If our signature matches GitHub's signature, the payload is authentic.
// If an attacker sends a request, they do not know our secret, so they cannot
// produce a valid signature — their request is rejected with 401.
//
// CRITICAL: crypto.timingSafeEqual() — Why Not === ?
// String comparison with === is vulnerable to timing attacks. If we compare character
// by character and return false the moment one mismatches, an attacker can measure
// microsecond differences in response time to statistically guess the correct signature
// byte-by-byte. timingSafeEqual() always compares ALL bytes in constant time,
// elminating this side-channel entirely.

export function verifyGithubSignature(req: Request, res: Response, next: NextFunction): void {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // EARLY REJECTION: If we have no secret configured, refuse all webhook traffic.
    // A server running without a webhook secret is critically misconfigured.
    if (!secret) {
        logger.error('SECURITY: GITHUB_WEBHOOK_SECRET is not set. Rejecting all webhook traffic.');
        res.status(500).json({ error: 'Webhook secret is not configured on this server.' });
        return;
    }

    // EARLY REJECTION: If GitHub did not send a signature header, the request is malformed or spoofed.
    if (!signature) {
        logger.warn('SECURITY: Webhook received with no x-hub-signature-256 header. Rejecting.');
        res.status(401).json({ error: 'Missing webhook signature.' });
        return;
    }

    // COMPUTE OUR EXPECTED SIGNATURE using the raw body buffer.
    // We use req.body here — but this only works if Express is configured to preserve the raw body.
    // We attach the raw buffer in app.ts using a verify callback on express.json().
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
        logger.error('INTEGRITY: rawBody was not attached to the request. Check express.json() configuration in app.ts.');
        res.status(500).json({ error: 'Internal signature verification error.' });
        return;
    }

    const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    // CONSTANT-TIME COMPARISON — immune to timing attacks
    const trusted = Buffer.from(expectedSignature, 'utf8');
    const received = Buffer.from(signature, 'utf8');

    if (trusted.length !== received.length || !crypto.timingSafeEqual(trusted, received)) {
        logger.warn(`SECURITY: Invalid webhook signature. Potential spoofed request rejected.`);
        res.status(401).json({ error: 'Invalid webhook signature.' });
        return;
    }

    // Signature verified. Allow the request to proceed to the controller.
    logger.debug('Webhook signature verified successfully.');
    next();
}
