import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import { configureNotificationHandler, removeNotificationHandler, listNotificationConfigsHandler } from '../controllers/notification.controller';

const notificationRouter = Router({ mergeParams: true });

notificationRouter.use(authenticate);

notificationRouter.get('/', listNotificationConfigsHandler);
notificationRouter.post('/', configureNotificationHandler);
notificationRouter.delete('/', removeNotificationHandler);

export { notificationRouter };
