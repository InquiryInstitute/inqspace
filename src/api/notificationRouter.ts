/**
 * Notification API Endpoints
 * GET /api/notifications, GET /api/notifications/unread
 * PUT /api/notifications/:notificationId/read
 * PUT /api/notifications/read-all
 */

import { Router, Request, Response, NextFunction } from 'express';
import { INotificationService } from '../types/services';

// Middleware to extract user ID from request (simplified for demo)
const extractUserId = (req: Request): string => {
  // In production, this would extract from JWT or session
  return req.headers['x-user-id']?.toString() || 'default-user';
};

export function createNotificationRouter(notificationService?: INotificationService): Router {
  const router = Router();

  // GET /api/notifications - Get all notifications for a user
  router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = extractUserId(req);
      const { unreadOnly } = req.query;

      const notifications = await (notificationService || ({} as INotificationService)).getNotifications(
        userId,
        unreadOnly === 'true'
      );

      res.json(notifications);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/notifications/unread - Get unread notifications
  router.get('/unread', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = extractUserId(req);

      const notifications = await (notificationService || ({} as INotificationService)).getNotifications(
        userId,
        true
      );

      res.json(notifications);
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/notifications/:notificationId/read - Mark notification as read
  router.put('/:notificationId/read', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { notificationId } = req.params;

      if (!notificationId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Notification ID is required',
          },
        });
        return;
      }

      await (notificationService || ({} as INotificationService)).markAsRead(notificationId);

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/notifications/read-all - Mark all notifications as read
  router.put('/read-all', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = extractUserId(req);

      await (notificationService || ({} as INotificationService)).markAllAsRead(userId);

      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  });

  // Error handling middleware
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('Notification API error:', err);
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
