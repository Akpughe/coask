import { agentRegistry } from '../agents/base-agent';
import { researchAgent } from '../agents/research-agent';
import { calendarAgent } from '../agents/calendar-agent';
import { jobProcessor } from '../queue/job-processor';
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
 * Perform all startup tasks
 */
export async function startup(): Promise<void> {
  logger.info('🚀 Starting Coask initialization...');

  // Initialize agents
  initializeAgents();

  // Initialize job processor
  initializeJobProcessor();

  logger.info('✅ Coask initialization complete');
}
