import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { config } from '../../core/config';
import { logger } from '../../utils/logger';
import {
  IEmailProvider,
  EmailParams,
  EmailResult,
  EmailProviderConfig,
} from '../email-provider';

/**
 * AWS SES Email Provider
 * Uses AWS Simple Email Service for sending emails
 */
export class SESProvider implements IEmailProvider {
  readonly name = 'ses';
  private client: SESClient | null = null;
  private configured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (config.awsSesAccessKey && config.awsSesSecretKey) {
      this.client = new SESClient({
        region: config.awsSesRegion,
        credentials: {
          accessKeyId: config.awsSesAccessKey,
          secretAccessKey: config.awsSesSecretKey,
        },
      });
      this.configured = true;
      logger.info('✅ AWS SES provider initialized', { region: config.awsSesRegion });
    } else {
      logger.warn('⚠️  AWS SES credentials not configured');
    }
  }

  isConfigured(): boolean {
    return this.configured && this.client !== null;
  }

  async send(params: EmailParams): Promise<EmailResult> {
    if (!this.isConfigured() || !this.client) {
      return {
        success: false,
        error: 'AWS SES provider not configured',
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
      logger.info('Sending email via AWS SES', {
        to: params.to,
        from: params.from,
        subject: params.subject,
      });

      // If attachments are present, use SendRawEmailCommand
      // Otherwise use SendEmailCommand (simpler)
      if (params.attachments && params.attachments.length > 0) {
        return await this.sendWithAttachments(params);
      }

      const toAddresses = Array.isArray(params.to) ? params.to : [params.to];
      const ccAddresses = params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : undefined;
      const bccAddresses = params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : undefined;

      const command = new SendEmailCommand({
        Source: params.from,
        Destination: {
          ToAddresses: toAddresses,
          CcAddresses: ccAddresses,
          BccAddresses: bccAddresses,
        },
        Message: {
          Subject: {
            Data: params.subject,
            Charset: 'UTF-8',
          },
          Body: params.html
            ? {
                Html: {
                  Data: params.html,
                  Charset: 'UTF-8',
                },
              }
            : {
                Text: {
                  Data: params.text || '',
                  Charset: 'UTF-8',
                },
              },
        },
        ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
      });

      const response = await this.client.send(command);

      logger.info('Email sent successfully via AWS SES', {
        messageId: response.MessageId,
      });

      return {
        success: true,
        messageId: response.MessageId,
        provider: this.name,
        metadata: {
          requestId: response.$metadata.requestId,
        },
      };
    } catch (error: any) {
      logger.error('AWS SES send failed', error);

      return {
        success: false,
        error: error.message || 'Failed to send email via AWS SES',
        provider: this.name,
        metadata: {
          errorCode: error.Code,
          errorDetails: error,
        },
      };
    }
  }

  /**
   * Send email with attachments using raw email format
   */
  private async sendWithAttachments(params: EmailParams): Promise<EmailResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'AWS SES client not initialized',
        provider: this.name,
      };
    }

    // Build MIME message
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    let rawMessage = '';

    // Headers
    rawMessage += `From: ${params.from}\r\n`;
    rawMessage += `To: ${Array.isArray(params.to) ? params.to.join(', ') : params.to}\r\n`;

    if (params.cc) {
      rawMessage += `Cc: ${Array.isArray(params.cc) ? params.cc.join(', ') : params.cc}\r\n`;
    }

    if (params.replyTo) {
      rawMessage += `Reply-To: ${params.replyTo}\r\n`;
    }

    rawMessage += `Subject: ${params.subject}\r\n`;
    rawMessage += `MIME-Version: 1.0\r\n`;
    rawMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

    // Body
    rawMessage += `--${boundary}\r\n`;
    rawMessage += `Content-Type: text/${params.html ? 'html' : 'plain'}; charset=UTF-8\r\n`;
    rawMessage += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    rawMessage += `${params.html || params.text}\r\n\r\n`;

    // Attachments
    for (const attachment of params.attachments || []) {
      rawMessage += `--${boundary}\r\n`;
      rawMessage += `Content-Type: ${attachment.contentType || 'application/octet-stream'}\r\n`;
      rawMessage += `Content-Transfer-Encoding: base64\r\n`;
      rawMessage += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`;

      const content = Buffer.isBuffer(attachment.content)
        ? attachment.content.toString('base64')
        : Buffer.from(attachment.content).toString('base64');

      rawMessage += `${content}\r\n\r\n`;
    }

    rawMessage += `--${boundary}--`;

    const command = new SendRawEmailCommand({
      RawMessage: {
        Data: Buffer.from(rawMessage),
      },
    });

    const response = await this.client.send(command);

    logger.info('Email with attachments sent via AWS SES', {
      messageId: response.MessageId,
    });

    return {
      success: true,
      messageId: response.MessageId,
      provider: this.name,
      metadata: {
        requestId: response.$metadata.requestId,
        hasAttachments: true,
      },
    };
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
      priority: 3, // AWS SES is tertiary provider
      supportsAttachments: true,
      supportsHtml: true,
      maxRecipientsPerEmail: 50,
      region: config.awsSesRegion,
    };
  }
}
