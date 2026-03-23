/**
 * Synchronization API Endpoints
 * GET /api/forks/:forkId/updates
 * POST /api/forks/:forkId/sync
 * POST /api/assignments/:assignmentId/notify-updates
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ISyncService } from '../types/services';
import { SyncResult, UpdateStatus } from '../types/services';

export function createSyncRouter(syncService?: ISyncService): Router {
  const router = Router();

  // GET /api/forks/:forkId/updates - Check for updates on a fork
  router.get('/forks/:forkId/updates', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { forkId } = req.params;

      if (!forkId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Fork ID is required',
          },
        });
        return;
      }

      const updateStatus: UpdateStatus = await (syncService || ({} as ISyncService)).checkForUpdates(forkId);

      res.json(updateStatus);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/forks/:forkId/sync - Sync a fork with upstream
  router.post('/forks/:forkId/sync', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { forkId } = req.params;

      if (!forkId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Fork ID is required',
          },
        });
        return;
      }

      const result: SyncResult = await (syncService || ({} as ISyncService)).syncFork(forkId);

      if (result.success) {
        res.json({ message: 'Fork synced successfully', conflicts: result.conflicts, hasUpdates: result.success });
      } else {
        res.status(409).json({ message: 'Sync failed', conflicts: result.conflicts, hasUpdates: result.success });
      }
    } catch (error) {
      next(error);
    }
  });

  // POST /api/assignments/:assignmentId/notify-updates - Notify students of updates
  router.post('/assignments/:assignmentId/notify-updates', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      await (syncService || ({} as ISyncService)).notifyStudentsOfUpdates(assignmentId);

      res.json({ message: 'Notifications sent successfully' });
    } catch (error) {
      next(error);
    }
  });

  // Error handling middleware
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('Sync API error:', err);
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
