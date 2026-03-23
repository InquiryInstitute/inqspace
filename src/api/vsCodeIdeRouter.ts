/**
 * VS Code IDE API Router
 * Handles API endpoints for VS Code IDE embedding and scripting
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IVsCodeIdeService } from '../types/services';
import { VsCodeIdeServiceError } from '../services';

/**
 * Create VS Code IDE router
 */
export function createVsCodeIdeRouter(vsCodeIdeService: IVsCodeIdeService): Router {
  const router = Router();

  /**
   * POST /api/codespaces
   * Create a new codespace
   * Request body: { repoId: string, ref: string, config?: CodespaceConfig }
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { repoId, ref, config } = req.body;

      if (!repoId || !ref) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'repoId and ref are required',
          },
        });
      }

      const codespace = await vsCodeIdeService.createCodespace(repoId, ref, config);

      return res.status(201).json({
        codespace,
        message: 'Codespace created successfully',
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/codespaces/:name/start
   * Start a codespace
   */
  router.post('/:name/start', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.params;

      if (!name) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Codespace name is required',
          },
        });
      }

      const codespace = await vsCodeIdeService.startCodespace(name);

      return res.status(200).json({
        codespace,
        message: 'Codespace started successfully',
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/codespaces/:name/stop
   * Stop a codespace
   */
  router.post('/:name/stop', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.params;

      if (!name) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Codespace name is required',
          },
        });
      }

      await vsCodeIdeService.stopCodespace(name);

      return res.status(200).json({
        message: 'Codespace stopped successfully',
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * DELETE /api/codespaces/:name
   * Delete a codespace
   */
  router.delete('/:name', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.params;

      if (!name) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Codespace name is required',
          },
        });
      }

      await vsCodeIdeService.deleteCodespace(name);

      return res.status(200).json({
        message: 'Codespace deleted successfully',
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/codespaces/:name
   * Get codespace details
   */
  router.get('/:name', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.params;

      if (!name) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Codespace name is required',
          },
        });
      }

      const codespace = await vsCodeIdeService.getCodespace(name);

      return res.status(200).json({
        codespace,
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/codespaces
   * List all codespaces
   */
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const codespaces = await vsCodeIdeService.listCodespaces();

      return res.status(200).json({
        codespaces,
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/codespaces/:name/health
   * Health check for codespace VS Code IDE
   */
  router.get('/:name/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.params;

      if (!name) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Codespace name is required',
          },
        });
      }

      const health = await vsCodeIdeService.healthCheck(name);

      return res.status(200).json({
        health,
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/codespaces/:name/mcp
   * Send MCP command to codespace
   */
  router.post('/:name/mcp', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.params;
      const { command } = req.body;

      if (!name) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Codespace name is required',
          },
        });
      }

      if (!command) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Command is required',
          },
        });
      }

      const response = await vsCodeIdeService.sendMcpCommand(name, command);

      return res.status(200).json({
        response,
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/codespaces/:name/action
   * Execute a VS Code action
   */
  router.post('/:name/action', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.params;
      const { action, params } = req.body;

      if (!name) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Codespace name is required',
          },
        });
      }

      if (!action) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Action is required',
          },
        });
      }

      const result = await vsCodeIdeService.executeVsCodeAction(name, action, params);

      return res.status(200).json({
        result,
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/codespaces/:name/urls
   * Get URLs for codespace ports
   */
  router.get('/:name/urls', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.params;

      if (!name) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Codespace name is required',
          },
        });
      }

      const urls = {
        codeServer: vsCodeIdeService.getCodeServerUrl(name),
        mcpEndpoint: vsCodeIdeService.getMcpEndpointUrl(name),
      };

      return res.status(200).json({
        urls,
      });
    } catch (error) {
      return next(error);
    }
  });

  // Error handler
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof VsCodeIdeServiceError) {
      return res.status(400).json({
        error: {
          code: 'SERVICE_ERROR',
          message: err.message,
        },
      });
    }

    console.error('VS Code IDE API error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      },
    });
  });

  return router;
}
