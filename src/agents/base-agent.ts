import { logger } from '../utils/logger';

/**
 * Agent capabilities - defines what an agent can do
 */
export interface AgentCapability {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

/**
 * Agent metadata
 */
export interface AgentMetadata {
  name: string;
  type: string;
  description: string;
  capabilities: AgentCapability[];
  version: string;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  userId: string;
  conversationId?: string;
  metadata?: Record<string, any>;
  useRAG?: boolean;
  ragCategory?: string;
}

/**
 * Agent task - represents work to be done
 */
export interface AgentTask {
  id: string;
  type: string;
  input: any;
  context: AgentContext;
  createdAt: Date;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  taskId: string;
  agentType: string;
  success: boolean;
  output?: any;
  error?: string;
  metadata?: {
    executionTime?: number;
    tokensUsed?: number;
    model?: string;
    [key: string]: any;
  };
  completedAt: Date;
}

/**
 * Base Agent Interface
 * All agents must implement this interface
 */
export interface IAgent {
  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata;

  /**
   * Execute a task
   */
  execute(task: AgentTask): Promise<AgentResult>;

  /**
   * Check if agent can handle a task
   */
  canHandle(taskType: string): boolean;

  /**
   * Get agent health status
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Abstract Base Agent
 * Provides common functionality for all agents
 */
export abstract class BaseAgent implements IAgent {
  protected agentName: string;
  protected agentType: string;
  protected agentDescription: string;
  protected agentVersion: string = '1.0.0';

  constructor(name: string, type: string, description: string) {
    this.agentName = name;
    this.agentType = type;
    this.agentDescription = description;

    logger.info(`✅ ${this.agentName} initialized`, { type: this.agentType });
  }

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata {
    return {
      name: this.agentName,
      type: this.agentType,
      description: this.agentDescription,
      capabilities: this.getCapabilities(),
      version: this.agentVersion,
    };
  }

  /**
   * Execute a task
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();

    logger.info(`${this.agentName}: Executing task`, {
      taskId: task.id,
      taskType: task.type,
      userId: task.context.userId,
    });

    try {
      // Validate task
      if (!this.canHandle(task.type)) {
        throw new Error(`Agent ${this.agentType} cannot handle task type: ${task.type}`);
      }

      // Execute task (implemented by subclass)
      const output = await this.executeTask(task);

      const executionTime = Date.now() - startTime;

      logger.info(`${this.agentName}: Task completed`, {
        taskId: task.id,
        executionTime: `${executionTime}ms`,
      });

      return {
        taskId: task.id,
        agentType: this.agentType,
        success: true,
        output,
        metadata: {
          executionTime,
          ...this.getExecutionMetadata(task, output),
        },
        completedAt: new Date(),
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error(`${this.agentName}: Task failed`, error, {
        taskId: task.id,
        executionTime: `${executionTime}ms`,
      });

      return {
        taskId: task.id,
        agentType: this.agentType,
        success: false,
        error: error.message,
        metadata: {
          executionTime,
        },
        completedAt: new Date(),
      };
    }
  }

  /**
   * Check if agent can handle a task
   */
  canHandle(taskType: string): boolean {
    const supportedTasks = this.getSupportedTaskTypes();
    return supportedTasks.includes(taskType);
  }

  /**
   * Default health check - can be overridden
   */
  async isHealthy(): Promise<boolean> {
    return true;
  }

  /**
   * Get agent capabilities - must be implemented by subclass
   */
  protected abstract getCapabilities(): AgentCapability[];

  /**
   * Get supported task types - must be implemented by subclass
   */
  protected abstract getSupportedTaskTypes(): string[];

  /**
   * Execute the actual task - must be implemented by subclass
   */
  protected abstract executeTask(task: AgentTask): Promise<any>;

  /**
   * Get execution metadata - can be overridden
   */
  protected getExecutionMetadata(task: AgentTask, output: any): Record<string, any> {
    return {};
  }

  /**
   * Generate unique task ID
   */
  protected generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Agent Registry - manages all available agents
 */
export class AgentRegistry {
  private agents: Map<string, IAgent> = new Map();

  constructor() {
    logger.info('✅ Agent Registry initialized');
  }

  /**
   * Register an agent
   */
  register(agent: IAgent): void {
    const metadata = agent.getMetadata();
    this.agents.set(metadata.type, agent);

    logger.info('Agent registered', {
      type: metadata.type,
      name: metadata.name,
    });
  }

  /**
   * Get agent by type
   */
  getAgent(agentType: string): IAgent | undefined {
    return this.agents.get(agentType);
  }

  /**
   * Get all agents
   */
  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Find agent that can handle a task
   */
  findAgentForTask(taskType: string): IAgent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.canHandle(taskType)) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * Get all agent metadata
   */
  getAllMetadata(): AgentMetadata[] {
    return Array.from(this.agents.values()).map((agent) => agent.getMetadata());
  }

  /**
   * Check health of all agents
   */
  async checkHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [type, agent] of this.agents.entries()) {
      health[type] = await agent.isHealthy();
    }

    return health;
  }
}

// Export singleton instance
export const agentRegistry = new AgentRegistry();
