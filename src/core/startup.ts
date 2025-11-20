import { agentRegistry } from '../agents/base-agent';
import { researchAgent } from '../agents/research-agent';
import { calendarAgent } from '../agents/calendar-agent';
import { jobProcessor } from '../queue/job-processor';
import { emailProviderManager } from '../email/email-provider-manager';
import { logger } from '../utils/logger';

/**
 * Startup initialization
 * Register all agents and perform other startup tasks
 */
export function initializeAgents(): void {
  logger.info('Initializing agents...');

  // Register all agents
  agentRegistry.register(researchAgent);
  agentRegistry.register(calendarAgent);
  // Note: Email agent doesn't extend BaseAgent yet, so we can't register it
  // This will be addressed in a future refactor

  logger.info('✅ All agents registered');
}

/**
 * Initialize job processor
 */
export function initializeJobProcessor(): void {
  logger.info('Initializing job processor...');

  // Job processor is initialized on import
  // Just verify it's running
  if (jobProcessor.isRunning()) {
    logger.info('✅ Job processor is running');
  } else {
    logger.warn('⚠️  Job processor is not running');
  }
}

/**
 * Initialize email providers
 */
export function initializeEmailProviders(): void {
  logger.info('Initializing email providers...');

  // Email provider manager is initialized on import
  // Get configured providers and domain routing
  const configuredProviders = emailProviderManager.getConfiguredProviders();
  const domainRoutings = emailProviderManager.getDomainRoutings();

  if (configuredProviders.length === 0) {
    logger.warn('⚠️  No email providers configured - email sending will be unavailable');
    return;
  }

  logger.info('✅ Email providers ready', {
    providers: configuredProviders.map((p) => ({
      name: p.name,
      priority: p.config.priority,
    })),
    domainRoutings: domainRoutings.length,
  });

  // Log domain routing configuration
  if (domainRoutings.length > 0) {
    domainRoutings.forEach((routing) => {
      logger.info('Email domain routing configured', {
        domain: routing.domain,
        provider: routing.provider,
        fromAddress: routing.fromAddress,
      });
    });
  } else {
    logger.info('No domain routing configured - using default provider for all emails');
  }
}

/**
 * Perform all startup tasks
 */
export async function startup(): Promise<void> {
  logger.info('🚀 Starting Coask initialization...');

  // Initialize agents
  initializeAgents();

  // Initialize job processor
  initializeJobProcessor();

  // Initialize email providers
  initializeEmailProviders();

  logger.info('✅ Coask initialization complete');
}
