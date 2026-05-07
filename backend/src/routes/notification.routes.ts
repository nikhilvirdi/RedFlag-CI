import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import { configureNotificationHandler, removeNotificationHandler, listNotificationConfigsHandler } from '../controllers/notification.controller';

const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get('/repositories/:repositoryId/notifications', listNotificationConfigsHandler);
notificationRouter.post('/repositories/:repositoryId/notifications', configureNotificationHandler);
notificationRouter.delete('/repositories/:repositoryId/notifications', removeNotificationHandler);

export { notificationRouter };
