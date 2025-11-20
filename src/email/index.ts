/**
 * Email Module
 * Central export file for all email-related types, interfaces, and classes
 */

// Email Provider Interfaces
export {
  IEmailProvider,
  IEmailProviderFactory,
  EmailParams,
  EmailResult,
  EmailAttachment,
  EmailProviderConfig,
} from './email-provider';

// Email Provider Manager
export { EmailProviderManager, DomainRouting, emailProviderManager } from './email-provider-manager';

// Email Provider Implementations
export { ResendProvider } from './providers/resend-provider';
export { SendGridProvider } from './providers/sendgrid-provider';
export { SESProvider } from './providers/ses-provider';
