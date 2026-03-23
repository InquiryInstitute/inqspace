/**
 * Assignment Management API Endpoints
 * POST /api/courses/:courseId/assignments
 * GET /api/assignments/:assignmentId, PUT /api/assignments/:assignmentId
 * DELETE /api/assignments/:assignmentId
 * GET /api/courses/:courseId/assignments
 * POST /api/assignments/:assignmentId/fork
 * GET /api/assignments/:assignmentId/forks
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IAssignmentService } from '../types/services';
import { AssignmentConfig, Fork } from '../types/models';

export function createAssignmentRouter(assignmentService?: IAssignmentService): Router {
  const router = Router();

  // POST /api/courses/:courseId/assignments - Create a new assignment
  router.post('/courses/:courseId/assignments', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { courseId } = req.params;
      const { configuration } = req.body;

      if (!courseId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Course ID is required',
          },
        });
        return;
      }

      const config: AssignmentConfig = {
        autoGrading: configuration?.autoGrading ?? false,
        maxAttempts: configuration?.maxAttempts,
        requiredFiles: configuration?.requiredFiles ?? [],
        starterCode: configuration?.starterCode ?? true,
        ...(configuration?.jupyterBook !== undefined ? { jupyterBook: configuration.jupyterBook } : {}),
      };

      const assignment = await (assignmentService || ({} as IAssignmentService)).createAssignment(
        courseId,
        config,
        req.body.templateRepositoryUrl
      );

      res.status(201).json(assignment);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/assignments/:assignmentId - Get an assignment by ID
  router.get('/assignments/:assignmentId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { assignmentId } = req.params;

      if (!assignmentId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Assignment ID is required',
          },
        });
        return;
      }

      const assignment = await (assignmentService || ({} as IAssignmentService)).getAssignment(assignmentId);

      if (!assignment) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Assignment with id ${assignmentId} not found`,
          },
        });
        return;
      }

      res.json(assignment);
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/assignments/:assignmentId - Update an assignment
  router.put('/assignments/:assignmentId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { assignmentId } = req.params;
      const updates = req.body;

      if (!assignmentId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Assignment ID is required',
          },
        });
        return;
      }

      const updatedAssignment = await (assignmentService || ({} as IAssignmentService)).updateAssignment(
        assignmentId,
        updates
      );

      res.json(updatedAssignment);
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/assignments/:assignmentId - Delete an assignment
  router.delete('/assignments/:assignmentId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { assignmentId } = req.params;

      if (!assignmentId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Assignment ID is required',
          },
        });
        return;
      }

      await (assignmentService || ({} as IAssignmentService)).deleteAssignment(assignmentId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // GET /api/courses/:courseId/assignments - List assignments by course
  router.get('/courses/:courseId/assignments', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { courseId } = req.params;

      if (!courseId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Course ID is required',
          },
        });
        return;
      }

      const assignments = await (assignmentService || ({} as IAssignmentService)).listAssignmentsByCourse(courseId);

      res.json(assignments);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/assignments/:assignmentId/fork - Fork an assignment for a student
  router.post('/assignments/:assignmentId/fork', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { assignmentId } = req.params;
      const { studentId } = req.body;

      if (!assignmentId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Assignment ID is required',
          },
        });
        return;
      }

      if (!studentId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Student ID is required',
          },
        });
        return;
      }

      const fork = await (assignmentService || ({} as IAssignmentService)).forkAssignment(
        assignmentId,
        studentId
      );

      res.status(201).json(fork);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/assignments/:assignmentId/forks - List forks for an assignment
  router.get('/assignments/:assignmentId/forks', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { assignmentId } = req.params;

      if (!assignmentId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Assignment ID is required',
          },
        });
        return;
      }

      const forks = await (assignmentService || ({} as IAssignmentService)).listAssignmentsByCourse(assignmentId)
        .then(() => [] as Fork[]);

      res.json(forks);
    } catch (error) {
      next(error);
    }
  });

  // Error handling middleware
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('Assignment API error:', err);
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
