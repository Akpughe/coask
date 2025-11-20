import { logger } from '../../utils/logger';
import { orchestrator } from '../../orchestration/orchestrator';
import { jobQueue, JobType } from '../../queue/job-queue';
import {
  WebhookEvent,
  WebhookConfig,
  WebhookHandlerResult,
  SlackWebhookPayload,
} from '../webhook-types';

/**
 * Slack Webhook Handler
 * Handles Slack webhook events and triggers appropriate workflows
 */
export async function handleSlackWebhook(
  event: WebhookEvent,
  config: WebhookConfig
): Promise<WebhookHandlerResult> {
  const payload = event.payload as SlackWebhookPayload;

  logger.info('Handling Slack webhook', {
    eventType: event.type,
    slackType: payload.type,
  });

  // Handle Slack URL verification challenge
  if (payload.type === 'url_verification' && payload.challenge) {
    return {
      success: true,
      message: 'URL verification challenge',
      metadata: {
        challenge: payload.challenge,
      },
    };
  }

  // Handle event callback
  if (payload.type === 'event_callback' && payload.event) {
    return handleSlackEvent(event, config, payload);
  }

  return {
    success: true,
    message: `Slack event type '${payload.type}' received`,
  };
}

/**
 * Handle Slack event callback
 */
async function handleSlackEvent(
  event: WebhookEvent,
  config: WebhookConfig,
  payload: SlackWebhookPayload
): Promise<WebhookHandlerResult> {
  const slackEvent = payload.event!;

  logger.info('Handling Slack event', {
    eventType: slackEvent.type,
    user: slackEvent.user,
    channel: slackEvent.channel,
  });

  // Handle message events
  if (slackEvent.type === 'message' || slackEvent.type === 'app_mention') {
    return handleSlackMessage(event, config, slackEvent);
  }

  return {
    success: true,
    message: `Slack event '${slackEvent.type}' received but not handled`,
  };
}

/**
 * Handle Slack message or app mention
 */
async function handleSlackMessage(
  event: WebhookEvent,
  config: WebhookConfig,
  slackEvent: any
): Promise<WebhookHandlerResult> {
  const text = slackEvent.text || '';
  const user = slackEvent.user;
  const channel = slackEvent.channel;

  logger.info('Slack message received', {
    text: text.substring(0, 100),
    user,
    channel,
  });

  // Check for bot trigger patterns
  const triggerPatterns = [
    /research\s+(.+)/i,
    /analyze\s+(.+)/i,
    /search\s+(.+)/i,
    /find\s+(.+)/i,
  ];

  let matchedQuery: string | null = null;

  for (const pattern of triggerPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      matchedQuery = match[1];
      break;
    }
  }

  // If workflow configured, trigger it
  if (config.triggerWorkflow) {
    try {
      const workflowId = await orchestrator.executeWorkflow(config.triggerWorkflow, {
        source: 'slack_webhook',
        eventType: slackEvent.type,
        text,
        user,
        channel,
        matchedQuery,
      });

      return {
        success: true,
        message: 'Workflow triggered from Slack message',
        workflowId,
        metadata: {
          channel,
          user,
        },
      };
    } catch (error: any) {
      logger.error('Failed to trigger workflow from Slack message', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // If query matched, queue research task
  if (matchedQuery) {
    const job = await jobQueue.addJob(
      JobType.RESEARCH_TASK,
      `slack_${user}`,
      {
        query: matchedQuery,
        options: {
          saveToKnowledgeBase: true,
          category: 'slack_requests',
        },
      }
    );

    return {
      success: true,
      message: 'Research job queued from Slack message',
      jobId: job.id || undefined,
      metadata: {
        channel,
        user,
        query: matchedQuery,
      },
    };
  }

  return {
    success: true,
    message: 'Slack message received but no action taken',
  };
}
