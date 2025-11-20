/**
 * Email Provider Abstraction Layer
 * Defines interfaces for multi-provider email system
 */

/**
 * Email send parameters
 */
export interface EmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  encoding?: string;
}

/**
 * Email send result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  metadata?: Record<string, any>;
}

/**
 * Email provider configuration
 */
export interface EmailProviderConfig {
  enabled: boolean;
  priority?: number; // Lower number = higher priority
  [key: string]: any;
}

/**
 * Email Provider Interface
 * All email providers must implement this interface
 */
export interface IEmailProvider {
  /**
   * Provider name (e.g., 'resend', 'sendgrid', 'ses')
   */
  readonly name: string;

  /**
   * Check if provider is configured and ready to send
   */
  isConfigured(): boolean;

  /**
   * Send an email
   */
  send(params: EmailParams): Promise<EmailResult>;

  /**
   * Validate email parameters
   */
  validate(params: EmailParams): { valid: boolean; errors?: string[] };

  /**
   * Get provider configuration
   */
  getConfig(): EmailProviderConfig;
}

/**
 * Email provider factory interface
 */
export interface IEmailProviderFactory {
  createProvider(name: string): IEmailProvider | null;
  getAvailableProviders(): string[];
}
