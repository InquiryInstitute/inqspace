/**
 * Submission and Grading API Endpoints
 * POST /api/forks/:forkId/submit
 * GET /api/submissions/:submissionId
 * POST /api/submissions/:submissionId/grade
 * POST /api/submissions/:submissionId/feedback
 * GET /api/assignments/:assignmentId/submissions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IGradingService } from '../types/services';

// Middleware to extract user ID from request (simplified for demo)
const extractUserId = (req: Request): string => {
  // In production, this would extract from JWT or session
  return req.headers['x-user-id']?.toString() || 'default-user';
};

export function createSubmissionRouter(gradingService?: IGradingService): Router {
  const router = Router();

  // POST /api/forks/:forkId/submit - Submit an assignment
  router.post('/forks/:forkId/submit', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { forkId } = req.params;
      const studentId = extractUserId(req);

      if (!forkId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Fork ID is required',
          },
        });
        return;
      }

      const submission = await (gradingService || ({} as IGradingService)).submitAssignment(forkId, studentId);

      res.status(201).json(submission);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/submissions/:submissionId - Get a submission by ID
  router.get('/submissions/:submissionId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { submissionId } = req.params;

      if (!submissionId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Submission ID is required',
          },
        });
        return;
      }

      const submission = await (gradingService || ({} as IGradingService)).getSubmission(submissionId);

      if (!submission) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Submission with id ${submissionId} not found`,
          },
        });
        return;
      }

      res.json(submission);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/submissions/:submissionId/grade - Grade a submission
  router.post('/submissions/:submissionId/grade', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { submissionId } = req.params;
      const { score, maxScore, comments } = req.body;
      const instructorId = extractUserId(req);

      if (!submissionId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Submission ID is required',
          },
        });
        return;
      }

      if (score === undefined || maxScore === undefined) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Score and maxScore are required',
          },
        });
        return;
      }

      await (gradingService || ({} as IGradingService)).gradeSubmission(submissionId, {
        score,
        maxScore,
        gradedBy: instructorId,
        gradedAt: new Date(),
        comments,
      });

      res.status(200).json({ message: 'Submission graded successfully' });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/submissions/:submissionId/feedback - Add feedback to a submission
  router.post('/submissions/:submissionId/feedback', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { submissionId } = req.params;
      const { content, lineNumber, filePath } = req.body;
      const authorId = extractUserId(req);

      if (!submissionId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Submission ID is required',
          },
        });
        return;
      }

      if (!content) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Feedback content is required',
          },
        });
        return;
      }

      await (gradingService || ({} as IGradingService)).addFeedback(submissionId, {
        id: `feedback-${Date.now()}`,
        authorId,
        content,
        lineNumber,
        filePath,
        createdAt: new Date(),
      });

      res.status(200).json({ message: 'Feedback added successfully' });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/assignments/:assignmentId/submissions - List submissions for an assignment
  router.get('/assignments/:assignmentId/submissions', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const submissions = await (gradingService || ({} as IGradingService)).listSubmissionsByAssignment(assignmentId);

      res.json(submissions);
    } catch (error) {
      next(error);
    }
  });

  // Error handling middleware
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('Submission API error:', err);
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
