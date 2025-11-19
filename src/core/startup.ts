import { agentRegistry } from '../agents/base-agent';
import { researchAgent } from '../agents/research-agent';
import { logger } from '../utils/logger';

/**
 * Startup initialization
 * Register all agents and perform other startup tasks
 */
export function initializeAgents(): void {
  logger.info('Initializing agents...');

  // Register all agents
  agentRegistry.register(researchAgent);
  // Note: Email agent doesn't extend BaseAgent yet, so we can't register it
  // This will be addressed in a future refactor

  logger.info('✅ All agents registered');
}

/**
 * Perform all startup tasks
 */
export async function startup(): Promise<void> {
  logger.info('🚀 Starting Coask initialization...');

  // Initialize agents
  initializeAgents();

  logger.info('✅ Coask initialization complete');
}
