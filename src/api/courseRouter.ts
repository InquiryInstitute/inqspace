/**
 * Course Management API Endpoints
 * POST /api/courses, GET /api/courses/:courseId
 * PUT /api/courses/:courseId, DELETE /api/courses/:courseId
 * GET /api/courses/instructor/:instructorId
 * POST /api/courses/:courseId/github-org
 */

import { Router, Request, Response } from 'express';
import { ICourseManagementService } from '../types/services';
import type { CourseXapiIntegration, CourseEmbedIntegration } from '../types/models';
import { asyncHandler, ValidationError, NotFoundError } from '../errors';
import { sanitizeCourseForClient } from '../embed/sanitizeCourse';
import { frameAncestorsFromCourse } from '../embed/embedSession';

// Middleware to extract user ID from request (simplified for demo)
const extractUserId = (req: Request): string => {
  // In production, this would extract from JWT or session
  return req.headers['x-user-id']?.toString() || 'default-user';
};

export function createCourseRouter(courseService?: ICourseManagementService): Router {
  const router = Router();

  // POST /api/courses - Create a new course
  router.post('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const instructorId = extractUserId(req);
    const { name, githubOrgName } = req.body;

    if (!name || !githubOrgName) {
      throw new ValidationError('Course name and GitHub organization name are required');
    }

    const course = await (courseService || ({} as ICourseManagementService)).createCourse(
      instructorId,
      name,
      githubOrgName
    );

    res.status(201).json(sanitizeCourseForClient(course));
  }));

  // GET /api/courses/:courseId - Get a course by ID
  router.get('/:courseId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { courseId } = req.params;

    if (!courseId) {
      throw new ValidationError('Course ID is required');
    }

    const course = await (courseService || ({} as ICourseManagementService)).getCourse(courseId);

    if (!course) {
      throw new NotFoundError('Course', courseId);
    }

    res.json(sanitizeCourseForClient(course));
  }));

  // PATCH /api/courses/:courseId/integrations/xapi — merge xAPI / LRS settings
  router.patch(
    '/:courseId/integrations/xapi',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { courseId } = req.params;
      if (!courseId) {
        throw new ValidationError('Course ID is required');
      }
      const course = await (courseService || ({} as ICourseManagementService)).getCourse(courseId);
      const body = req.body as Partial<CourseXapiIntegration>;
      const merged: CourseXapiIntegration = {
        enabled: body.enabled ?? course.metadata?.xapi?.enabled ?? false,
        lrsBaseUrl: body.lrsBaseUrl ?? course.metadata?.xapi?.lrsBaseUrl ?? '',
        lrsBasicUsername: body.lrsBasicUsername ?? course.metadata?.xapi?.lrsBasicUsername ?? '',
        lrsBasicPasswordSecret:
          body.lrsBasicPasswordSecret ?? course.metadata?.xapi?.lrsBasicPasswordSecret ?? '',
        activityBaseIri: body.activityBaseIri ?? course.metadata?.xapi?.activityBaseIri,
      };
      const updated = await (courseService || ({} as ICourseManagementService)).updateCourse(courseId, {
        metadata: { ...course.metadata, xapi: merged },
      });
      res.json(sanitizeCourseForClient(updated));
    })
  );

  // PATCH /api/courses/:courseId/integrations/embed — merge iframe embed policy
  router.patch(
    '/:courseId/integrations/embed',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { courseId } = req.params;
      if (!courseId) {
        throw new ValidationError('Course ID is required');
      }
      const course = await (courseService || ({} as ICourseManagementService)).getCourse(courseId);
      const body = req.body as Partial<CourseEmbedIntegration>;
      const merged: CourseEmbedIntegration = {
        enabled: body.enabled ?? course.metadata?.embed?.enabled ?? false,
        allowedFrameAncestors:
          body.allowedFrameAncestors ?? course.metadata?.embed?.allowedFrameAncestors ?? [],
      };
      const updated = await (courseService || ({} as ICourseManagementService)).updateCourse(courseId, {
        metadata: { ...course.metadata, embed: merged },
      });
      res.json(sanitizeCourseForClient(updated));
    })
  );

  // GET /api/courses/:courseId/embed/csp — suggested frame-ancestors value for HTML responses
  router.get(
    '/:courseId/embed/csp',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { courseId } = req.params;
      if (!courseId) {
        throw new ValidationError('Course ID is required');
      }
      const course = await (courseService || ({} as ICourseManagementService)).getCourse(courseId);
      const fa = frameAncestorsFromCourse(course);
      res.json({
        frameAncestors: fa,
        contentSecurityPolicy: fa ? `frame-ancestors ${fa}` : null,
      });
    })
  );

  // PUT /api/courses/:courseId - Update a course
  router.put('/:courseId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { courseId } = req.params;
    const updates = req.body;

    if (!courseId) {
      throw new ValidationError('Course ID is required');
    }

    const updatedCourse = await (courseService || ({} as ICourseManagementService)).updateCourse(
      courseId,
      updates
    );

    res.json(sanitizeCourseForClient(updatedCourse));
  }));

  // DELETE /api/courses/:courseId - Delete a course
  router.delete('/:courseId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { courseId } = req.params;
    const { confirmOrgDeletion = false } = req.body;

    if (!courseId) {
      throw new ValidationError('Course ID is required');
    }

    await (courseService || ({} as ICourseManagementService)).deleteCourse(
      courseId,
      confirmOrgDeletion
    );

    res.status(204).send();
  }));

  // GET /api/courses/instructor/:instructorId - List courses by instructor
  router.get('/instructor/:instructorId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { instructorId } = req.params;

    if (!instructorId) {
      throw new ValidationError('Instructor ID is required');
    }

    const courses = await (courseService || ({} as ICourseManagementService)).listCoursesByInstructor(
      instructorId
    );

    res.json(courses.map(sanitizeCourseForClient));
  }));

  // POST /api/courses/:courseId/github-org - Associate GitHub organization with course
  router.post('/:courseId/github-org', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { courseId } = req.params;
    const { orgName } = req.body;

    if (!courseId || !orgName) {
      throw new ValidationError('Course ID and organization name are required');
    }

    await (courseService || ({} as ICourseManagementService)).associateGitHubOrg(courseId, orgName);

    res.status(200).json({ message: 'GitHub organization associated successfully' });
  }));

  return router;
}
