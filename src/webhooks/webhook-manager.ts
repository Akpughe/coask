import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { webhookVerifier } from './webhook-verifier';
import {
  WebhookConfig,
  WebhookEvent,
  WebhookHandler,
  WebhookHandlerResult,
} from './webhook-types';

/**
 * Webhook Manager
 * Manages webhook registrations, routing, and handler execution
 */
export class WebhookManager {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private handlers: Map<string, WebhookHandler> = new Map();
  private urlToWebhookId: Map<string, string> = new Map();

  constructor() {
    logger.info('✅ Webhook Manager initialized');
  }

  /**
   * Register a new webhook
   */
  registerWebhook(config: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt'>): WebhookConfig {
    const webhookConfig: WebhookConfig = {
      ...config,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(webhookConfig.id, webhookConfig);
    this.urlToWebhookId.set(webhookConfig.url, webhookConfig.id);

    logger.info('Webhook registered', {
      id: webhookConfig.id,
      name: webhookConfig.name,
      source: webhookConfig.source,
      url: webhookConfig.url,
    });

    return webhookConfig;
  }

  /**
   * Update an existing webhook
   */
  updateWebhook(id: string, updates: Partial<WebhookConfig>): WebhookConfig | null {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      logger.warn('Webhook not found for update', { id });
      return null;
    }

    // Update URL mapping if URL changed
    if (updates.url && updates.url !== webhook.url) {
      this.urlToWebhookId.delete(webhook.url);
      this.urlToWebhookId.set(updates.url, id);
    }

    const updatedWebhook: WebhookConfig = {
      ...webhook,
      ...updates,
      id, // Ensure ID doesn't change
      createdAt: webhook.createdAt, // Preserve creation date
      updatedAt: new Date(),
    };

    this.webhooks.set(id, updatedWebhook);

    logger.info('Webhook updated', { id, updates: Object.keys(updates) });

    return updatedWebhook;
  }

  /**
   * Delete a webhook
   */
  deleteWebhook(id: string): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      logger.warn('Webhook not found for deletion', { id });
      return false;
    }

    this.webhooks.delete(id);
    this.urlToWebhookId.delete(webhook.url);

    logger.info('Webhook deleted', { id, name: webhook.name });

    return true;
  }

  /**
   * Get webhook by ID
   */
  getWebhook(id: string): WebhookConfig | null {
    return this.webhooks.get(id) || null;
  }

  /**
   * Get webhook by URL path
   */
  getWebhookByUrl(url: string): WebhookConfig | null {
    const id = this.urlToWebhookId.get(url);
    return id ? this.webhooks.get(id) || null : null;
  }

  /**
   * Get all webhooks
   */
  getAllWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get webhooks by source
   */
  getWebhooksBySource(source: string): WebhookConfig[] {
    return Array.from(this.webhooks.values()).filter((w) => w.source === source);
  }

  /**
   * Register a handler for a specific source
   */
  registerHandler(source: string, handler: WebhookHandler): void {
    this.handlers.set(source.toLowerCase(), handler);
    logger.info('Webhook handler registered', { source });
  }

  /**
   * Process an incoming webhook event
   */
  async processWebhook(
    url: string,
    payload: any,
    headers: Record<string, string>
  ): Promise<WebhookHandlerResult> {
    // Find webhook config by URL
    const config = this.getWebhookByUrl(url);

    if (!config) {
      logger.warn('Webhook not found for URL', { url });
      return {
        success: false,
        error: 'Webhook not found',
      };
    }

    if (!config.enabled) {
      logger.warn('Webhook disabled', { id: config.id, url });
      return {
        success: false,
        error: 'Webhook is disabled',
      };
    }

    // Verify webhook signature if secret is configured
    let verified = true;
    if (config.secret) {
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const verification = webhookVerifier.verify(
        config.source,
        payloadString,
        headers,
        config.secret
      );

      verified = verification.verified;

      if (!verified) {
        logger.error('Webhook verification failed', {
          id: config.id,
          source: config.source,
          error: verification.error,
        });

        return {
          success: false,
          error: `Webhook verification failed: ${verification.error}`,
        };
      }
    }

    // Create webhook event
    const event: WebhookEvent = {
      id: uuidv4(),
      source: config.source,
      type: this.extractEventType(config.source, payload),
      timestamp: new Date(),
      payload: typeof payload === 'string' ? JSON.parse(payload) : payload,
      headers,
      verified,
    };

    logger.info('Processing webhook event', {
      webhookId: config.id,
      eventId: event.id,
      source: event.source,
      type: event.type,
      verified: event.verified,
    });

    // Get handler for this source
    const handler = this.handlers.get(config.source.toLowerCase());

    if (!handler) {
      logger.warn('No handler registered for webhook source', {
        source: config.source,
      });

      return {
        success: false,
        error: `No handler registered for source: ${config.source}`,
      };
    }

    // Execute handler
    try {
      const result = await handler(event, config);

      logger.info('Webhook processed successfully', {
        webhookId: config.id,
        eventId: event.id,
        success: result.success,
        workflowId: result.workflowId,
        jobId: result.jobId,
      });

      return result;
    } catch (error: any) {
      logger.error('Webhook handler error', error);

      return {
        success: false,
        error: error.message || 'Webhook handler failed',
      };
    }
  }

  /**
   * Extract event type from payload based on source
   */
  private extractEventType(source: string, payload: any): string {
    switch (source.toLowerCase()) {
      case 'github':
        return payload['action'] || payload['event'] || 'unknown';

      case 'slack':
        return payload['type'] || payload['event']?.['type'] || 'unknown';

      case 'custom':
        return payload['event'] || payload['type'] || 'custom';

      default:
        return 'unknown';
    }
  }

  /**
   * Get webhook statistics
   */
  getStats() {
    return {
      totalWebhooks: this.webhooks.size,
      enabledWebhooks: Array.from(this.webhooks.values()).filter((w) => w.enabled).length,
      bySource: this.getWebhookCountsBySource(),
      registeredHandlers: Array.from(this.handlers.keys()),
    };
  }

  /**
   * Get webhook counts grouped by source
   */
  private getWebhookCountsBySource(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const webhook of this.webhooks.values()) {
      counts[webhook.source] = (counts[webhook.source] || 0) + 1;
    }

    return counts;
  }
}

export const webhookManager = new WebhookManager();
