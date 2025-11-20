import { Resend } from 'resend';
import { config } from '../../core/config';
import { logger } from '../../utils/logger';
import {
  IEmailProvider,
  EmailParams,
  EmailResult,
  EmailProviderConfig,
} from '../email-provider';

/**
 * Resend Email Provider
 * Uses Resend API for sending emails
 */
export class ResendProvider implements IEmailProvider {
  readonly name = 'resend';
  private client: Resend | null = null;
  private configured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (config.resendApiKey) {
      this.client = new Resend(config.resendApiKey);
      this.configured = true;
      logger.info('✅ Resend provider initialized');
    } else {
      logger.warn('⚠️  Resend API key not configured');
    }
  }

  isConfigured(): boolean {
    return this.configured && this.client !== null;
  }

  async send(params: EmailParams): Promise<EmailResult> {
    if (!this.isConfigured() || !this.client) {
      return {
        success: false,
        error: 'Resend provider not configured',
        provider: this.name,
      };
    }

    // Validate parameters
    const validation = this.validate(params);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors?.join(', ')}`,
        provider: this.name,
      };
    }

    try {
      logger.info('Sending email via Resend', {
        to: params.to,
        from: params.from,
        subject: params.subject,
      });

      const emailPayload: any = {
        from: params.from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
      };

      // Add content (prioritize HTML)
      if (params.html) {
        emailPayload.html = params.html;
      } else if (params.text) {
        emailPayload.text = params.text;
      }

      // Add optional fields only if they exist
      if (params.cc) {
        emailPayload.cc = Array.isArray(params.cc) ? params.cc : [params.cc];
      }
      if (params.bcc) {
        emailPayload.bcc = Array.isArray(params.bcc) ? params.bcc : [params.bcc];
      }
      if (params.replyTo) {
        emailPayload.replyTo = Array.isArray(params.replyTo) ? params.replyTo : [params.replyTo];
      }
      if (params.attachments && params.attachments.length > 0) {
        emailPayload.attachments = params.attachments.map((att) => ({
          filename: att.filename,
          content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content),
        }));
      }
      if (params.headers) {
        emailPayload.headers = params.headers;
      }

      const response = await this.client.emails.send(emailPayload);

      logger.info('Email sent successfully via Resend', {
        messageId: response.data?.id,
      });

      return {
        success: true,
        messageId: response.data?.id,
        provider: this.name,
        metadata: {
          response: response.data,
        },
      };
    } catch (error: any) {
      logger.error('Resend send failed', error);

      return {
        success: false,
        error: error.message || 'Failed to send email via Resend',
        provider: this.name,
        metadata: {
          errorDetails: error,
        },
      };
    }
  }

  validate(params: EmailParams): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!params.from) {
      errors.push('From address is required');
    }

    if (!params.to || (Array.isArray(params.to) && params.to.length === 0)) {
      errors.push('At least one recipient (to) is required');
    }

    if (!params.subject) {
      errors.push('Subject is required');
    }

    if (!params.html && !params.text) {
      errors.push('Either HTML or text content is required');
    }

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (params.from && !emailRegex.test(params.from.replace(/^.*<([^>]+)>$/, '$1'))) {
      errors.push('Invalid from email format');
    }

    const validateEmails = (emails: string | string[] | undefined, field: string) => {
      if (!emails) return;
      const emailList = Array.isArray(emails) ? emails : [emails];
      emailList.forEach((email) => {
        const cleanEmail = email.replace(/^.*<([^>]+)>$/, '$1');
        if (!emailRegex.test(cleanEmail)) {
          errors.push(`Invalid ${field} email format: ${email}`);
        }
      });
    };

    validateEmails(params.to, 'to');
    validateEmails(params.cc, 'cc');
    validateEmails(params.bcc, 'bcc');

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getConfig(): EmailProviderConfig {
    return {
      enabled: this.configured,
      priority: 1, // Resend is primary provider
      supportsAttachments: true,
      supportsHtml: true,
      maxRecipientsPerEmail: 50,
    };
  }
}
