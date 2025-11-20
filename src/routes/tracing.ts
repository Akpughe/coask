import { Router, Request, Response } from 'express';
import { traceManager } from '../tracing/trace-manager';
import { TraceQuery } from '../tracing/trace-types';
import { logger } from '../utils/logger';

const router: Router = Router();

/**
 * GET /tracing
 * Query traces with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query: TraceQuery = {
      userId: req.query.userId as string,
      workflowId: req.query.workflowId as string,
      status: req.query.status as any,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    // Parse date filters
    if (req.query.startTimeFrom) {
      query.startTimeFrom = new Date(req.query.startTimeFrom as string);
    }

    if (req.query.startTimeTo) {
      query.startTimeTo = new Date(req.query.startTimeTo as string);
    }

    const traces = traceManager.queryTraces(query);

    res.json({
      success: true,
      data: traces,
      count: traces.length,
    });
  } catch (error: any) {
    logger.error('Error querying traces', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to query traces',
    });
  }
});

/**
 * GET /tracing/active
 * Get currently active traces
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const activeTraces = traceManager.getActiveTraces();

    res.json({
      success: true,
      data: activeTraces,
      count: activeTraces.length,
    });
  } catch (error: any) {
    logger.error('Error fetching active traces', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch active traces',
    });
  }
});

/**
 * GET /tracing/stats
 * Get trace statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = traceManager.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Error fetching trace stats', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch trace stats',
    });
  }
});

/**
 * GET /tracing/export
 * Export traces as JSON
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const query: TraceQuery = {
      userId: req.query.userId as string,
      workflowId: req.query.workflowId as string,
      status: req.query.status as any,
    };

    // Parse date filters
    if (req.query.startTimeFrom) {
      query.startTimeFrom = new Date(req.query.startTimeFrom as string);
    }

    if (req.query.startTimeTo) {
      query.startTimeTo = new Date(req.query.startTimeTo as string);
    }

    const exportData = traceManager.exportTraces(query);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=traces-export.json');
    res.send(exportData);
  } catch (error: any) {
    logger.error('Error exporting traces', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to export traces',
    });
  }
});

/**
 * GET /tracing/:id
 * Get specific trace by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trace = traceManager.getTrace(id);

    if (!trace) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Trace not found',
      });
    }

    res.json({
      success: true,
      data: trace,
    });
  } catch (error: any) {
    logger.error('Error fetching trace', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch trace',
    });
  }
});

/**
 * DELETE /tracing/:id
 * Delete a trace
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = traceManager.deleteTrace(id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Trace not found',
      });
    }

    res.json({
      success: true,
      message: 'Trace deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting trace', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to delete trace',
    });
  }
});

/**
 * DELETE /tracing
 * Clear all traces
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    traceManager.clearAll();

    res.json({
      success: true,
      message: 'All traces cleared',
    });
  } catch (error: any) {
    logger.error('Error clearing traces', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to clear traces',
    });
  }
});

export default router;
