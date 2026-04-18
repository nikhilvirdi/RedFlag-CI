import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { connectDatabase, prisma } from './config/db';
import './workers/scan.worker'; // Importing boots the worker — it starts listening immediately

// We wrap the server startup in an async 'bootstrap' function 
// so we can pause and wait for the database to connect FIRST.
async function bootstrap() {
    // 1. Establish Database Connection strictly before accepting HTTP traffic.
    await connectDatabase();

    // 2. Start the Express server
    const server = app.listen(env.PORT, () => {
        logger.info(`✅ Server successfully started on port ${env.PORT}`);
        logger.info(`🌍 Environment: ${env.NODE_ENV}`);
        logger.info(`🩺 Healthcheck: http://localhost:${env.PORT}/healthcheck\n`);
    });

    /**
     * 🔌 Graceful Shutdown (Production Best Practice)
     */
    process.on('SIGINT', async () => {
        logger.warn('⚠️ Gracefully shutting down... (Received SIGINT)');
        
        server.close(async () => {
            logger.info('HTTP server closed.');

            // Close the BullMQ worker: stop accepting new jobs, finish current ones
            const { scanWorker } = await import('./workers/scan.worker');
            await scanWorker.close();
            logger.info('Scan worker shut down cleanly.');

            // Close the database connection to prevent memory leaks/corruption
            await prisma.$disconnect();
            logger.info('Database connection safely terminated.');

            process.exit(0);
        });
    });
}

bootstrap();
