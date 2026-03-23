/**
 * API Router for GitHub Classroom Support
 * Centralized routing for all REST API endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createCourseRouter } from './courseRouter';
import { createAssignmentRouter } from './assignmentRouter';
import { createSubmissionRouter } from './submissionRouter';
import { createAuthRouter } from './authRouter';
import { createSyncRouter } from './syncRouter';
import { createNotificationRouter } from './notificationRouter';
import { createVsCodeIdeRouter } from './vsCodeIdeRouter';
import { createEmbedRouter } from './embedRouter';
import { createJupyterBookRouter } from './jupyterBookRouter';
import { createIdeLaunchRouter } from './ideLaunchRouter';
import { defaultContainer } from '../di/container';
import {
  InMemoryCourseRepository,
  InMemoryAssignmentRepository,
  InMemoryForkRepository,
  InMemorySubmissionRepository,
  InMemoryNotificationRepository,
  InMemoryUserRepository,
  InMemoryAuthTokenRepository,
} from '../repositories';

/**
 * Create the main API router with services wired via DI container
 */
export function createApiRouter(): Router {
  const router = Router();

  // Create repositories
  const courseRepository = new InMemoryCourseRepository();
  const assignmentRepository = new InMemoryAssignmentRepository();
  const forkRepository = new InMemoryForkRepository();
  const notificationRepository = new InMemoryNotificationRepository();
  const userRepository = new InMemoryUserRepository();
  const authTokenRepository = new InMemoryAuthTokenRepository();
  const submissionRepository = new InMemorySubmissionRepository(assignmentRepository);

  // Create services via DI container
  const services = defaultContainer.createServices({
    courseRepository,
    assignmentRepository,
    forkRepository,
    submissionRepository,
    notificationRepository,
    userRepository,
    authTokenRepository,
  });

  // Mount all sub-routers with services
  router.use('/courses', createCourseRouter(services.courseManagementService));
  router.use('/assignments', createAssignmentRouter(services.assignmentService));
  router.use('/forks', createSubmissionRouter(services.gradingService));
  router.use('/auth', createAuthRouter(services.authService));
  router.use('/sync', createSyncRouter(services.syncService));
  router.use('/notifications', createNotificationRouter(services.notificationService));
  router.use('/codespaces', createVsCodeIdeRouter(services.vsCodeIdeService));
  router.use(
    '/embed',
    createEmbedRouter(services.courseManagementService, {
      embedSecret: process.env.INQSPACE_EMBED_SECRET || 'dev-embed-secret-change-me',
      embedBaseUrl: process.env.INQSPACE_EMBED_BASE_URL || 'http://localhost:3000',
    })
  );
  router.use('/jupyter-book', createJupyterBookRouter(services.jupyterBookService));
  router.use('/ide', createIdeLaunchRouter());

  // Health check endpoint
  router.get('/health', (_req: Request, res: Response): void => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handling middleware
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('API error:', err);
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
