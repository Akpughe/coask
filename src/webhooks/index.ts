/**
 * Webhooks Module
 * Phase 5: External Integrations & Observability
 */

export {
  WebhookEvent,
  WebhookConfig,
  WebhookHandler,
  WebhookHandlerResult,
  WebhookVerification,
  GitHubWebhookPayload,
  SlackWebhookPayload,
  CustomWebhookPayload,
} from './webhook-types';

export { WebhookVerifier, webhookVerifier } from './webhook-verifier';
export { WebhookManager, webhookManager } from './webhook-manager';

export { handleGitHubWebhook } from './handlers/github-handler';
export { handleSlackWebhook } from './handlers/slack-handler';
export { handleCustomWebhook } from './handlers/custom-handler';
