import { logger } from '../../utils/logger';
import { orchestrator } from '../../orchestration/orchestrator';
import { jobQueue, JobType } from '../../queue/job-queue';
import {
  WebhookEvent,
  WebhookConfig,
  WebhookHandlerResult,
  CustomWebhookPayload,
} from '../webhook-types';

/**
 * Custom Webhook Handler
 * Handles custom webhook events with flexible routing
 */
export async function handleCustomWebhook(
  event: WebhookEvent,
  config: WebhookConfig
): Promise<WebhookHandlerResult> {
  const payload = event.payload as CustomWebhookPayload;

  logger.info('Handling custom webhook', {
    eventType: event.type,
    customEvent: payload.event,
  });

  // If workflow is configured, trigger it
  if (config.triggerWorkflow) {
    try {
      const workflowId = await orchestrator.executeWorkflow(config.triggerWorkflow, {
        source: 'custom_webhook',
        eventType: event.type,
        webhookId: config.id,
        webhookName: config.name,
        data: payload.data,
        metadata: payload.metadata,
      });

      return {
        success: true,
        message: 'Workflow triggered from custom webhook',
        workflowId,
      };
    } catch (error: any) {
      logger.error('Failed to trigger workflow from custom webhook', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Route based on event type if no workflow configured
  switch (payload.event?.toLowerCase()) {
    case 'research':
    case 'search':
      return handleResearchEvent(payload);

    case 'email':
    case 'send_email':
      return handleEmailEvent(payload);

    case 'calendar':
    case 'schedule':
      return handleCalendarEvent(payload);

    default:
      logger.debug('Unhandled custom event type', { event: payload.event });
      return {
        success: true,
        message: `Custom event '${payload.event}' received but no handler configured`,
      };
  }
}

/**
 * Handle research event from custom webhook
 */
async function handleResearchEvent(payload: CustomWebhookPayload): Promise<WebhookHandlerResult> {
  const query = payload.data.query || payload.data.text;

  if (!query) {
    return {
      success: false,
      error: 'No query provided in research event',
    };
  }

  const job = await jobQueue.addJob(
    JobType.RESEARCH_TASK,
    payload.data.userId || 'custom_webhook',
    {
      query,
      options: {
        saveToKnowledgeBase: payload.data.saveToKnowledgeBase !== false,
        category: payload.data.category || 'custom_webhook',
        webSearch: payload.data.webSearch !== false,
      },
    }
  );

  return {
    success: true,
    message: 'Research job queued from custom webhook',
    jobId: job.id || undefined,
  };
}

/**
 * Handle email event from custom webhook
 */
async function handleEmailEvent(payload: CustomWebhookPayload): Promise<WebhookHandlerResult> {
  const { to, subject, context, from, userId } = payload.data;

  if (!to || !subject || !context) {
    return {
      success: false,
      error: 'Missing required fields: to, subject, context',
    };
  }

  const job = await jobQueue.addJob(
    JobType.EMAIL_DRAFT,
    userId || 'custom_webhook',
    {
      action: 'draft',
      to,
      subject,
      context,
      tone: payload.data.tone || 'professional',
      length: payload.data.length || 'medium',
      autoSend: payload.data.autoSend === true,
      from,
    }
  );

  return {
    success: true,
    message: 'Email job queued from custom webhook',
    jobId: job.id || undefined,
  };
}

/**
 * Handle calendar event from custom webhook
 */
async function handleCalendarEvent(payload: CustomWebhookPayload): Promise<WebhookHandlerResult> {
  const { action, userId } = payload.data;

  if (!action) {
    return {
      success: false,
      error: 'No action specified for calendar event',
    };
  }

  const job = await jobQueue.addJob(
    JobType.CALENDAR_EVENT,
    userId || 'custom_webhook',
    {
      action,
      data: payload.data,
    }
  );

  return {
    success: true,
    message: 'Calendar job queued from custom webhook',
    jobId: job.id || undefined,
  };
}
