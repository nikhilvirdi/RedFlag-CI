import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { connectDatabase, prisma } from './config/db';
import './workers/scan.worker';

async function bootstrap() {
    await connectDatabase();

    const server = app.listen(env.PORT, () => {
        logger.info(`✅ Server successfully started on port ${env.PORT}`);
        logger.info(`🌍 Environment: ${env.NODE_ENV}`);
        logger.info(`🩺 Healthcheck: http://localhost:${env.PORT}/healthcheck\n`);
    });

    process.on('SIGINT', async () => {
        logger.warn('⚠️ Gracefully shutting down... (Received SIGINT)');
        
        server.close(async () => {
            logger.info('HTTP server closed.');

            const { scanWorker } = await import('./workers/scan.worker');
            await scanWorker.close();
            logger.info('Scan worker shut down cleanly.');

            await prisma.$disconnect();
            logger.info('Database connection safely terminated.');

            process.exit(0);
        });
    });
}

bootstrap();
