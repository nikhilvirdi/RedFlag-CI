import { Router } from 'express';
import {
    redirectToGitHub,
    handleOAuthCallback,
    getCurrentUser,
} from '../controllers/auth.controller';

const authRouter = Router();

authRouter.get('/github/redirect', redirectToGitHub);
authRouter.get('/github/callback', handleOAuthCallback);
authRouter.get('/me', getCurrentUser);

export { authRouter };
