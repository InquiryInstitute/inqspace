/**
 * Authentication API Endpoints
 * GET /api/auth/github/initiate, GET /api/auth/github/callback
 * GET /api/auth/google/initiate, GET /api/auth/google/callback
 * POST /api/auth/logout, GET /api/auth/session
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IAuthService } from '../types/services';

export function createAuthRouter(authService?: IAuthService): Router {
  const router = Router();

  // GET /api/auth/github/initiate - Initiate GitHub OAuth flow
  router.get('/github/initiate', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authUrl = await (authService || ({} as IAuthService)).initiateGitHubAuth();

      res.json({ authUrl });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/auth/github/callback - GitHub OAuth callback
  router.get('/github/callback', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = _req.query;

      if (!code) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Authorization code is required',
          },
        });
        return;
      }

      const user = await (authService || ({} as IAuthService)).completeGitHubAuth(code as string);

      // Create session for user
      const sessionId = await (authService || ({} as IAuthService)).createSession(user.id);

      res.json({
        user,
        sessionId,
        message: 'Authentication successful',
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/auth/google/initiate - Initiate Google OAuth flow
  router.get('/google/initiate', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authUrl = await (authService || ({} as IAuthService)).initiateGoogleAuth();

      res.json({ authUrl });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/auth/google/callback - Google OAuth callback
  router.get('/google/callback', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = _req.query;

      if (!code) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Authorization code is required',
          },
        });
        return;
      }

      const user = await (authService || ({} as IAuthService)).completeGoogleAuth(code as string);

      // Create session for user
      const sessionId = await (authService || ({} as IAuthService)).createSession(user.id);

      res.json({
        user,
        sessionId,
        message: 'Authentication successful',
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/auth/logout - Logout user
  router.post('/logout', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = _req.body;

      if (!sessionId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Session ID is required',
          },
        });
        return;
      }

      await (authService || ({} as IAuthService)).destroySession(sessionId);

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/auth/session - Get current session
  router.get('/session', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = _req.headers['x-session-id']?.toString();

      if (!sessionId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Session ID is required',
          },
        });
        return;
      }

      const user = await (authService || ({} as IAuthService)).validateSession(sessionId);

      res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  // Error handling middleware
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('Auth API error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        details: process.env.NODE_ENV === 'development' ? { message: err.message } : undefined,
      },
    });
  });

  return router;
}
