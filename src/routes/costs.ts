import { Router, Request, Response } from 'express';
import { costTracker } from '../cost-tracking/cost-tracker';
import { CostQuery } from '../cost-tracking/cost-types';
import { logger } from '../utils/logger';

const router: Router = Router();

/**
 * GET /costs/summary
 * Get cost summary with filters
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const query: CostQuery = {
      userId: req.query.userId as string,
      provider: req.query.provider as string,
      model: req.query.model as string,
      traceId: req.query.traceId as string,
    };

    // Parse date filters
    if (req.query.startDate) {
      query.startDate = new Date(req.query.startDate as string);
    }

    if (req.query.endDate) {
      query.endDate = new Date(req.query.endDate as string);
    }

    const summary = costTracker.getCostSummary(query);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    logger.error('Error getting cost summary', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to get cost summary',
    });
  }
});

/**
 * GET /costs
 * Query cost entries
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query: CostQuery = {
      userId: req.query.userId as string,
      provider: req.query.provider as string,
      model: req.query.model as string,
      traceId: req.query.traceId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    // Parse date filters
    if (req.query.startDate) {
      query.startDate = new Date(req.query.startDate as string);
    }

    if (req.query.endDate) {
      query.endDate = new Date(req.query.endDate as string);
    }

    const entries = costTracker.queryCosts(query);

    res.json({
      success: true,
      data: entries,
      count: entries.length,
    });
  } catch (error: any) {
    logger.error('Error querying costs', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to query costs',
    });
  }
});

/**
 * GET /costs/export
 * Export cost data
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const query: CostQuery = {
      userId: req.query.userId as string,
      provider: req.query.provider as string,
      model: req.query.model as string,
      traceId: req.query.traceId as string,
    };

    // Parse date filters
    if (req.query.startDate) {
      query.startDate = new Date(req.query.startDate as string);
    }

    if (req.query.endDate) {
      query.endDate = new Date(req.query.endDate as string);
    }

    const exportData = costTracker.exportCosts(query);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=costs-export.json');
    res.send(exportData);
  } catch (error: any) {
    logger.error('Error exporting costs', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to export costs',
    });
  }
});

/**
 * GET /costs/budgets
 * Get all budgets
 */
router.get('/budgets', async (req: Request, res: Response) => {
  try {
    const budgets = costTracker.getBudgets();

    res.json({
      success: true,
      data: budgets,
      count: budgets.length,
    });
  } catch (error: any) {
    logger.error('Error fetching budgets', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch budgets',
    });
  }
});

/**
 * POST /costs/budgets
 * Create a new budget
 */
router.post('/budgets', async (req: Request, res: Response) => {
  try {
    const { userId, name, limit, period, alertThreshold = 80, enabled = true } = req.body;

    // Validation
    if (!name || !limit || !period) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name, limit, and period are required',
      });
    }

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'period must be one of: daily, weekly, monthly',
      });
    }

    const budget = costTracker.createBudget({
      userId,
      name,
      limit: parseFloat(limit),
      period,
      alertThreshold: parseFloat(alertThreshold),
      enabled,
    });

    res.status(201).json({
      success: true,
      data: budget,
    });
  } catch (error: any) {
    logger.error('Error creating budget', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to create budget',
    });
  }
});

/**
 * GET /costs/alerts
 * Get recent cost alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const alerts = costTracker.getAlerts(limit);

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error: any) {
    logger.error('Error fetching alerts', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch alerts',
    });
  }
});

export default router;
