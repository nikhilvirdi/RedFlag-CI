/**
 * Redis Configuration
 * 
 * Purpose: Initializes the connection to our Redis database.
 * This is structurally critical for setting up BullMQ (our message queue)
 * and avoiding the slow child-process bottleneck we flagged earlier.
 */
