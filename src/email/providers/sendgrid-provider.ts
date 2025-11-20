import sgMail from '@sendgrid/mail';
import { config } from '../../core/config';
import { logger } from '../../utils/logger';
import {
  IEmailProvider,
  EmailParams,
  EmailResult,
  EmailProviderConfig,
} from '../email-provider';

/**
 * SendGrid Email Provider
 * Uses SendGrid API for sending emails
 */
export class SendGridProvider implements IEmailProvider {
  readonly name = 'sendgrid';
  private configured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (config.sendgridApiKey) {
      sgMail.setApiKey(config.sendgridApiKey);
      this.configured = true;
      logger.info('✅ SendGrid provider initialized');
    } else {
      logger.warn('⚠️  SendGrid API key not configured');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async send(params: EmailParams): Promise<EmailResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'SendGrid provider not configured',
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
      logger.info('Sending email via SendGrid', {
        to: params.to,
        from: params.from,
        subject: params.subject,
      });

      const message: any = {
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      };

      if (params.cc) {
        message.cc = params.cc;
      }

      if (params.bcc) {
        message.bcc = params.bcc;
      }

      if (params.replyTo) {
        message.replyTo = params.replyTo;
      }

      if (params.attachments && params.attachments.length > 0) {
        message.attachments = params.attachments.map((att) => ({
          filename: att.filename,
          content: Buffer.isBuffer(att.content)
            ? att.content.toString('base64')
            : Buffer.from(att.content).toString('base64'),
          type: att.contentType,
          disposition: 'attachment',
        }));
      }

      if (params.headers) {
        message.headers = params.headers;
      }

      const [response] = await sgMail.send(message);

      logger.info('Email sent successfully via SendGrid', {
        statusCode: response.statusCode,
        messageId: response.headers['x-message-id'],
      });

      return {
        success: true,
        messageId: response.headers['x-message-id'] as string,
        provider: this.name,
        metadata: {
          statusCode: response.statusCode,
          headers: response.headers,
        },
      };
    } catch (error: any) {
      logger.error('SendGrid send failed', error);

      return {
        success: false,
        error: error.message || 'Failed to send email via SendGrid',
        provider: this.name,
        metadata: {
          errorDetails: error.response?.body || error,
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
      priority: 2, // SendGrid is secondary provider
      supportsAttachments: true,
      supportsHtml: true,
      maxRecipientsPerEmail: 1000,
    };
  }
}
