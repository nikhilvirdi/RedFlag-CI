/**
 * Scan Service
 * 
 * Purpose: This is where the core business logic lives. 
 * Once the controller receives a webhook, it calls this service to:
 * 1. Evaluate the PR data.
 * 2. Dispatch a scan job to the Redis queue for the Python workers.
 * 3. Handle the lifecycle of a scan result.
 */
