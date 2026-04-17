/**
 * Error Handling Middleware
 * 
 * Purpose: Centralized location to catch ANY errors thrown anywhere in the app.
 * Instead of crashing the server, this middleware will format the error nicely,
 * log it via our logger, and send a clean 500/400 response back to the client.
 */
