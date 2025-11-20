import { logger } from '../utils/logger';
import { IEmailProvider, EmailParams, EmailResult } from './email-provider';
import { ResendProvider } from './providers/resend-provider';
import { SendGridProvider } from './providers/sendgrid-provider';
import { SESProvider } from './providers/ses-provider';

/**
 * Domain routing configuration
 * Maps email domains to specific providers
 */
export interface DomainRouting {
  domain: string;
  provider: string;
  fromAddress?: string; // Optional default from address for this domain
}

/**
 * Email Provider Manager
 * Manages multiple email providers and routes emails based on domain configuration
 */
export class EmailProviderManager {
  private providers: Map<string, IEmailProvider> = new Map();
  private domainRouting: Map<string, DomainRouting> = new Map();
  private defaultProvider: string = 'resend';

  constructor() {
    this.initializeProviders();
    this.loadDomainRouting();
  }

  /**
   * Initialize all available email providers
   */
  private initializeProviders(): void {
    logger.info('Initializing email providers...');

    const resend = new ResendProvider();
    const sendgrid = new SendGridProvider();
    const ses = new SESProvider();

    this.providers.set(resend.name, resend);
    this.providers.set(sendgrid.name, sendgrid);
    this.providers.set(ses.name, ses);

    // Log configured providers
    const configuredProviders = Array.from(this.providers.values())
      .filter((p) => p.isConfigured())
      .map((p) => p.name);

    logger.info('✅ Email providers initialized', {
      total: this.providers.size,
      configured: configuredProviders,
    });

    // Set default provider to first configured one
    if (configuredProviders.length > 0) {
      this.defaultProvider = configuredProviders[0];
      logger.info(`Default email provider: ${this.defaultProvider}`);
    } else {
      logger.warn('⚠️  No email providers configured!');
    }
  }

  /**
   * Load domain routing configuration from environment
   * Format: EMAIL_DOMAIN_test.com_PROVIDER=sendgrid
   *         EMAIL_DOMAIN_test.com_FROM=hello@test.com
   */
  private loadDomainRouting(): void {
    const envVars = process.env;
    const domainPattern = /^EMAIL_DOMAIN_([^_]+)_([A-Z]+)$/;

    const domains = new Map<string, Partial<DomainRouting>>();

    Object.keys(envVars).forEach((key) => {
      const match = key.match(domainPattern);
      if (match) {
        const domain = match[1];
        const field = match[2];
        const value = envVars[key];

        if (!domains.has(domain)) {
          domains.set(domain, { domain });
        }

        const routing = domains.get(domain)!;

        if (field === 'PROVIDER') {
          routing.provider = value;
        } else if (field === 'FROM') {
          routing.fromAddress = value;
        }
      }
    });

    // Add complete domain routings
    domains.forEach((routing, domain) => {
      if (routing.provider) {
        this.domainRouting.set(domain, routing as DomainRouting);
        logger.info('Domain routing configured', {
          domain,
          provider: routing.provider,
          fromAddress: routing.fromAddress,
        });
      }
    });

    if (this.domainRouting.size === 0) {
      logger.info('No domain routing configured - using default provider for all emails');
    }
  }

  /**
   * Add or update domain routing programmatically
   */
  addDomainRouting(routing: DomainRouting): void {
    if (!this.providers.has(routing.provider)) {
      throw new Error(`Provider not found: ${routing.provider}`);
    }

    this.domainRouting.set(routing.domain, routing);
    logger.info('Domain routing added', routing);
  }

  /**
   * Get provider for a given email address
   * Extracts domain and checks routing configuration
   */
  getProviderForEmail(email: string): IEmailProvider | null {
    const domain = this.extractDomain(email);

    // Check if there's a specific routing for this domain
    if (this.domainRouting.has(domain)) {
      const routing = this.domainRouting.get(domain)!;
      const provider = this.providers.get(routing.provider);

      if (provider && provider.isConfigured()) {
        logger.debug('Using domain-routed provider', {
          domain,
          provider: provider.name,
        });
        return provider;
      }
    }

    // Fall back to default provider
    const defaultProv = this.providers.get(this.defaultProvider);
    if (defaultProv && defaultProv.isConfigured()) {
      logger.debug('Using default provider', {
        domain,
        provider: defaultProv.name,
      });
      return defaultProv;
    }

    // Return any configured provider as last resort
    for (const provider of this.providers.values()) {
      if (provider.isConfigured()) {
        logger.warn('Using fallback provider', {
          domain,
          provider: provider.name,
        });
        return provider;
      }
    }

    logger.error('No configured email provider available');
    return null;
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): IEmailProvider | null {
    return this.providers.get(name) || null;
  }

  /**
   * Send email using appropriate provider
   */
  async send(params: EmailParams): Promise<EmailResult> {
    // Determine which provider to use based on 'from' address
    const provider = this.getProviderForEmail(params.from);

    if (!provider) {
      return {
        success: false,
        error: 'No email provider available',
        provider: 'none',
      };
    }

    // Check if domain has a default 'from' address and use it if not provided
    const domain = this.extractDomain(params.from);
    const routing = this.domainRouting.get(domain);

    if (routing?.fromAddress && !params.from) {
      params.from = routing.fromAddress;
    }

    // Send via selected provider
    return await provider.send(params);
  }

  /**
   * Get list of all configured providers
   */
  getConfiguredProviders(): Array<{ name: string; config: any }> {
    return Array.from(this.providers.values())
      .filter((p) => p.isConfigured())
      .map((p) => ({
        name: p.name,
        config: p.getConfig(),
      }));
  }

  /**
   * Get all domain routing configurations
   */
  getDomainRoutings(): DomainRouting[] {
    return Array.from(this.domainRouting.values());
  }

  /**
   * Set default provider
   */
  setDefaultProvider(providerName: string): void {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const provider = this.providers.get(providerName)!;
    if (!provider.isConfigured()) {
      throw new Error(`Provider not configured: ${providerName}`);
    }

    this.defaultProvider = providerName;
    logger.info('Default provider updated', { provider: providerName });
  }

  /**
   * Check if any provider is configured
   */
  hasConfiguredProvider(): boolean {
    return Array.from(this.providers.values()).some((p) => p.isConfigured());
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string {
    // Handle "Name <email@domain.com>" format
    const cleanEmail = email.replace(/^.*<([^>]+)>$/, '$1');

    // Extract domain
    const parts = cleanEmail.split('@');
    return parts.length === 2 ? parts[1] : '';
  }
}

// Export singleton instance
export const emailProviderManager = new EmailProviderManager();
