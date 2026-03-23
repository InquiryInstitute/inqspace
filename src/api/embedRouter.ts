/**
 * Embed session API — mint JWT for iframe embed URLs.
 * POST /api/embed/sessions
 */

import { Router, Request, Response } from 'express';
import { ICourseManagementService } from '../types/services';
import { asyncHandler, ValidationError } from '../errors';
import { createEmbedSession } from '../embed/embedSession';

export interface EmbedRouterConfig {
  embedSecret: string;
  embedBaseUrl: string;
}

export function createEmbedRouter(
  courseService: ICourseManagementService | undefined,
  config: EmbedRouterConfig
): Router {
  const router = Router();

  router.post(
    '/sessions',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { courseId, userId, assignmentId, lectureId, ttlSeconds } = req.body as {
        courseId?: string;
        userId?: string;
        assignmentId?: string;
        lectureId?: string;
        ttlSeconds?: number;
      };
      if (!courseId || !userId) {
        throw new ValidationError('courseId and userId are required');
      }
      await (courseService || ({} as ICourseManagementService)).getCourse(courseId);
      const result = createEmbedSession({
        userId,
        courseId,
        assignmentId,
        lectureId,
        ttlSeconds,
        secret: config.embedSecret,
        embedBaseUrl: config.embedBaseUrl,
      });
      res.status(201).json(result);
    })
  );

  return router;
}
