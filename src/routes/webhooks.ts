import { Router, Request, Response } from 'express';
import { webhookManager } from '../webhooks/webhook-manager';
import { logger } from '../utils/logger';

const router: Router = Router();

/**
 * Webhook handler function
 */
async function handleWebhook(req: Request, res: Response) {
  try {
    const source = req.params.source;
    const path = req.params.path || '';
    const url = `/webhooks/${source}${path ? '/' + path : ''}`;
    const payload = req.body;
    const headers: Record<string, string> = {};

    // Extract relevant headers
    Object.keys(req.headers).forEach((key) => {
      const value = req.headers[key];
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });

    logger.info('Webhook received', {
      url,
      source,
      method: req.method,
      contentType: headers['content-type'],
    });

    // Process webhook
    const result = await webhookManager.processWebhook(url, payload, headers);

    // Handle Slack URL verification challenge specially
    if (result.metadata?.challenge) {
      return res.json({ challenge: result.metadata.challenge });
    }

    if (!result.success) {
      return res.status(400).json({
        error: 'Webhook Processing Failed',
        message: result.error || 'Failed to process webhook',
      });
    }

    res.json({
      success: true,
      message: result.message,
      workflowId: result.workflowId,
      jobId: result.jobId,
    });
  } catch (error: any) {
    logger.error('Webhook endpoint error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to process webhook',
    });
  }
}

/**
 * POST /webhooks/:source
 * Generic webhook receiver endpoint
 */
router.post('/:source', handleWebhook);

/**
 * POST /webhooks/:source/:path
 * Generic webhook receiver endpoint with path
 */
router.post('/:source/:path', handleWebhook);

/**
 * POST /webhooks/register
 * Register a new webhook
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, source, url, secret, enabled = true, events, triggerWorkflow, metadata } = req.body;

    // Validation
    if (!name || !source || !url) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name, source, and url are required',
      });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'events array is required and must not be empty',
      });
    }

    const webhook = webhookManager.registerWebhook({
      name,
      source,
      url,
      secret,
      enabled,
      events,
      triggerWorkflow,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: webhook,
    });
  } catch (error: any) {
    logger.error('Error registering webhook', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to register webhook',
    });
  }
});

/**
 * GET /webhooks
 * Get all webhooks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { source } = req.query;

    const webhooks = source
      ? webhookManager.getWebhooksBySource(source as string)
      : webhookManager.getAllWebhooks();

    res.json({
      success: true,
      data: webhooks,
      count: webhooks.length,
    });
  } catch (error: any) {
    logger.error('Error fetching webhooks', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch webhooks',
    });
  }
});

/**
 * GET /webhooks/stats
 * Get webhook statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = webhookManager.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Error fetching webhook stats', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch webhook stats',
    });
  }
});

/**
 * GET /webhooks/:id
 * Get specific webhook by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const webhook = webhookManager.getWebhook(id);

    if (!webhook) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Webhook not found',
      });
    }

    res.json({
      success: true,
      data: webhook,
    });
  } catch (error: any) {
    logger.error('Error fetching webhook', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch webhook',
    });
  }
});

/**
 * PUT /webhooks/:id
 * Update a webhook
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating id, createdAt
    delete updates.id;
    delete updates.createdAt;

    const webhook = webhookManager.updateWebhook(id, updates);

    if (!webhook) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Webhook not found',
      });
    }

    res.json({
      success: true,
      data: webhook,
    });
  } catch (error: any) {
    logger.error('Error updating webhook', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to update webhook',
    });
  }
});

/**
 * DELETE /webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = webhookManager.deleteWebhook(id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Webhook not found',
      });
    }

    res.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting webhook', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to delete webhook',
    });
  }
});

export default router;
