/**
 * Webhook Types and Interfaces
 * Phase 5: External Integrations & Observability
 */

/**
 * Webhook event payload structure
 */
export interface WebhookEvent {
  id: string;
  source: string; // 'github', 'slack', 'custom', etc.
  type: string; // Event type (e.g., 'push', 'message', 'task.created')
  timestamp: Date;
  payload: Record<string, any>;
  headers: Record<string, string>;
  verified: boolean;
}

/**
 * Webhook registration configuration
 */
export interface WebhookConfig {
  id: string;
  name: string;
  source: string;
  url: string; // The URL path for this webhook (e.g., '/webhooks/github')
  secret?: string; // Secret for verifying webhook signatures
  enabled: boolean;
  events: string[]; // Event types this webhook listens for
  triggerWorkflow?: string; // Optional workflow to trigger
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook handler function type
 */
export type WebhookHandler = (
  event: WebhookEvent,
  config: WebhookConfig
) => Promise<WebhookHandlerResult>;

/**
 * Result returned by webhook handlers
 */
export interface WebhookHandlerResult {
  success: boolean;
  message?: string;
  workflowId?: string;
  jobId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Webhook verification result
 */
export interface WebhookVerification {
  verified: boolean;
  error?: string;
  source?: string;
}

/**
 * GitHub webhook specific types
 */
export interface GitHubWebhookPayload {
  action?: string;
  repository?: {
    name: string;
    full_name: string;
    owner: { login: string };
  };
  sender?: {
    login: string;
  };
  issue?: {
    number: number;
    title: string;
    body: string;
    state: string;
  };
  pull_request?: {
    number: number;
    title: string;
    body: string;
    state: string;
  };
  comment?: {
    body: string;
    user: { login: string };
  };
}

/**
 * Slack webhook specific types
 */
export interface SlackWebhookPayload {
  type: string;
  team_id?: string;
  event?: {
    type: string;
    user: string;
    text: string;
    channel: string;
    ts: string;
  };
  challenge?: string; // For URL verification
}

/**
 * Custom webhook payload (flexible schema)
 */
export interface CustomWebhookPayload {
  event: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}
