import { logger } from '../../utils/logger';
import { orchestrator } from '../../orchestration/orchestrator';
import { jobQueue, JobType } from '../../queue/job-queue';
import {
  WebhookEvent,
  WebhookConfig,
  WebhookHandlerResult,
  GitHubWebhookPayload,
} from '../webhook-types';

/**
 * GitHub Webhook Handler
 * Handles GitHub webhook events and triggers appropriate workflows
 */
export async function handleGitHubWebhook(
  event: WebhookEvent,
  config: WebhookConfig
): Promise<WebhookHandlerResult> {
  const payload = event.payload as GitHubWebhookPayload;

  logger.info('Handling GitHub webhook', {
    eventType: event.type,
    action: payload.action,
    repository: payload.repository?.full_name,
  });

  // Handle different GitHub event types
  switch (event.type) {
    case 'opened':
    case 'reopened':
      return handleIssueOrPROpened(event, config, payload);

    case 'created':
      return handleCommentCreated(event, config, payload);

    case 'push':
      return handlePush(event, config, payload);

    case 'synchronize':
      return handlePRUpdated(event, config, payload);

    default:
      logger.debug('Unhandled GitHub event type', { type: event.type });
      return {
        success: true,
        message: `GitHub event type '${event.type}' received but not handled`,
      };
  }
}

/**
 * Handle issue or PR opened
 */
async function handleIssueOrPROpened(
  event: WebhookEvent,
  config: WebhookConfig,
  payload: GitHubWebhookPayload
): Promise<WebhookHandlerResult> {
  const isIssue = !!payload.issue;
  const isPR = !!payload.pull_request;

  const item = isIssue ? payload.issue! : payload.pull_request!;

  logger.info(`GitHub ${isIssue ? 'issue' : 'PR'} opened`, {
    number: item.number,
    title: item.title,
    repository: payload.repository?.full_name,
  });

  // If a workflow is configured, trigger it
  if (config.triggerWorkflow) {
    try {
      const workflowId = await orchestrator.executeWorkflow(config.triggerWorkflow, {
        source: 'github_webhook',
        eventType: event.type,
        repository: payload.repository?.full_name,
        [isIssue ? 'issue' : 'pull_request']: item,
        sender: payload.sender,
      });

      return {
        success: true,
        message: `Workflow triggered for ${isIssue ? 'issue' : 'PR'} #${item.number}`,
        workflowId,
      };
    } catch (error: any) {
      logger.error('Failed to trigger workflow from GitHub webhook', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Default behavior: Queue a research task
  const job = await jobQueue.addJob(
    JobType.RESEARCH_TASK,
    'github_webhook',
    {
      query: `Analyze this GitHub ${isIssue ? 'issue' : 'pull request'}: ${item.title}\n\n${item.body || 'No description provided'}`,
      options: {
        saveToKnowledgeBase: true,
        category: 'github_events',
      },
    }
  );

  return {
    success: true,
    message: `Research job queued for ${isIssue ? 'issue' : 'PR'} #${item.number}`,
    jobId: job.id || undefined,
  };
}

/**
 * Handle comment created
 */
async function handleCommentCreated(
  event: WebhookEvent,
  config: WebhookConfig,
  payload: GitHubWebhookPayload
): Promise<WebhookHandlerResult> {
  const comment = payload.comment;
  const issue = payload.issue;
  const pr = payload.pull_request;

  if (!comment) {
    return {
      success: false,
      error: 'No comment in payload',
    };
  }

  logger.info('GitHub comment created', {
    commentBody: comment.body?.substring(0, 100),
    user: comment.user?.login,
    repository: payload.repository?.full_name,
  });

  // Check if comment mentions the bot or contains trigger words
  const triggerWords = ['@coask', '/analyze', '/research'];
  const shouldTrigger = triggerWords.some((word) => comment.body?.toLowerCase().includes(word));

  if (!shouldTrigger) {
    return {
      success: true,
      message: 'Comment received but no trigger word found',
    };
  }

  // If workflow configured, trigger it
  if (config.triggerWorkflow) {
    try {
      const workflowId = await orchestrator.executeWorkflow(config.triggerWorkflow, {
        source: 'github_webhook',
        eventType: 'comment_created',
        repository: payload.repository?.full_name,
        comment,
        issue: issue || pr,
        sender: payload.sender,
      });

      return {
        success: true,
        message: 'Workflow triggered from comment',
        workflowId,
      };
    } catch (error: any) {
      logger.error('Failed to trigger workflow from GitHub comment', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Default: Queue research task
  const job = await jobQueue.addJob(
    JobType.RESEARCH_TASK,
    'github_webhook',
    {
      query: comment.body || '',
      options: {
        saveToKnowledgeBase: true,
        category: 'github_comments',
      },
    }
  );

  return {
    success: true,
    message: 'Research job queued from comment',
    jobId: job.id || undefined,
  };
}

/**
 * Handle push event
 */
async function handlePush(
  event: WebhookEvent,
  config: WebhookConfig,
  payload: GitHubWebhookPayload
): Promise<WebhookHandlerResult> {
  logger.info('GitHub push event', {
    repository: payload.repository?.full_name,
    sender: payload.sender?.login,
  });

  // If workflow configured, trigger it
  if (config.triggerWorkflow) {
    try {
      const workflowId = await orchestrator.executeWorkflow(config.triggerWorkflow, {
        source: 'github_webhook',
        eventType: 'push',
        repository: payload.repository?.full_name,
        sender: payload.sender,
        payload,
      });

      return {
        success: true,
        message: 'Workflow triggered from push event',
        workflowId,
      };
    } catch (error: any) {
      logger.error('Failed to trigger workflow from GitHub push', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  return {
    success: true,
    message: 'Push event received',
  };
}

/**
 * Handle PR synchronized (updated)
 */
async function handlePRUpdated(
  event: WebhookEvent,
  config: WebhookConfig,
  payload: GitHubWebhookPayload
): Promise<WebhookHandlerResult> {
  const pr = payload.pull_request;

  if (!pr) {
    return {
      success: false,
      error: 'No pull request in payload',
    };
  }

  logger.info('GitHub PR updated', {
    number: pr.number,
    title: pr.title,
    repository: payload.repository?.full_name,
  });

  // If workflow configured, trigger it
  if (config.triggerWorkflow) {
    try {
      const workflowId = await orchestrator.executeWorkflow(config.triggerWorkflow, {
        source: 'github_webhook',
        eventType: 'pr_updated',
        repository: payload.repository?.full_name,
        pull_request: pr,
        sender: payload.sender,
      });

      return {
        success: true,
        message: `Workflow triggered for PR #${pr.number} update`,
        workflowId,
      };
    } catch (error: any) {
      logger.error('Failed to trigger workflow from PR update', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  return {
    success: true,
    message: `PR #${pr.number} update received`,
  };
}
