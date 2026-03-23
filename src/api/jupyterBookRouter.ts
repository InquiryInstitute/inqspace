/**
 * Jupyter Book — effective paths, course policy, YAML parse helper.
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { IJupyterBookService } from '../types/services';

export function createJupyterBookRouter(jupyterBookService: IJupyterBookService): Router {
  const router = Router();

  router.get('/courses/:courseId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { courseId } = req.params;
      if (!courseId) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Course ID is required' } });
        return;
      }
      const integration = await jupyterBookService.getCourseIntegration(courseId);
      res.json({
        integration,
        defaults: integration?.paths ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/assignments/:assignmentId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { assignmentId } = req.params;
      if (!assignmentId) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Assignment ID is required' } });
        return;
      }
      const effective = await jupyterBookService.getEffectiveForAssignment(assignmentId);
      res.json(effective);
    } catch (error) {
      next(error);
    }
  });

  router.post('/parse', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { configYaml, tocYaml } = req.body as { configYaml?: string; tocYaml?: string };
      if (!configYaml || typeof configYaml !== 'string') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'configYaml string is required' } });
        return;
      }
      const bundle = jupyterBookService.parseYamlBundle(configYaml, tocYaml);
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
