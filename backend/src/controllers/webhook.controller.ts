import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * 💡 Production Practice: Controller Slimness
 * A Controller should ONLY do three things:
 * 1. Extract data from the incoming Request (Headers, Body)
 * 2. Hand that data off to a Service (The actual business logic)
 * 3. Return a Response to the client.
 * 
 * It should NEVER contain complex `if-else` business logic or database queries directly!
 */

export const handleGithubWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // 1. Extract the GitHub event type (e.g., "pull_request", "push")
        const githubEvent = req.headers['x-github-event'];
        
        // 2. Extract the actual JSON data GitHub sent us
        const payload = req.body;

        logger.info(`📥 Received Webhook Event: [${githubEvent}]`);

        // TODO: In the next step, we will use a crypto library to verify GitHub's secret signature here!
        // We must reject hackers trying to send fake webhooks to our system.

        // 💡 Production Practice: Early Acknowledgement
        // GitHub expects a 200 OK response within 10 seconds. If we run a 3-minute AI Python scan here, 
        // GitHub will assume our server crashed and angrily mark the webhook as "Failed".
        // Therefore, we instantly reply 200 OK, and hand the heavy lifting off to a background Queue!
        res.status(200).json({ status: 'success', message: 'Webhook received and queued for processing.' });

        // TODO: Push the payload to our Redis BullMQ queue here

    } catch (error) {
        // 💡 Production Practice: The Global Error Net
        // We NEVER do `res.status(500).json({ error: error.message })` inside a controller. 
        // We pass the error strictly to the `next()` function, which throws it into our custom 
        // Error Handler middleware (errorHandler.middleware.ts) to process it securely.
        next(error);
    }
};
