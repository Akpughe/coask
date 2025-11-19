import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../core/config';
import { logger } from '../utils/logger';
import { JobType, JobData, jobQueue } from './job-queue';
import { agentOrchestrator } from '../orchestration/agent-orchestrator';
import { agentRegistry } from '../agents/base-agent';
import { getWorkflow } from '../orchestration/workflows';
import { AgentTask } from '../agents/base-agent';

/**
 * Job processing result
 */
export interface JobProcessingResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
  metadata?: Record<string, any>;
}

/**
 * Job Processor
 * Processes jobs from the queue using BullMQ Worker
 */
export class JobProcessor {
  private worker: Worker;
  private redisConnection: Redis;

  constructor() {
    // Create Redis connection for the worker
    this.redisConnection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    // Create BullMQ worker
    this.worker = new Worker('coask-jobs', this.processJob.bind(this), {
      connection: this.redisConnection,
      concurrency: 5, // Process up to 5 jobs concurrently
      limiter: {
        max: 100, // Max 100 jobs
        duration: 60000, // per minute
      },
    });

    // Worker event listeners
    this.worker.on('completed', (job: Job) => {
      logger.info('Job completed', {
        jobId: job.id,
        jobType: (job.data as JobData).type,
        duration: `${job.finishedOn! - job.processedOn!}ms`,
      });
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error('Job failed', err, {
        jobId: job?.id,
        jobType: job ? (job.data as JobData).type : 'unknown',
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('active', (job: Job) => {
      logger.debug('Job started', {
        jobId: job.id,
        jobType: (job.data as JobData).type,
      });
    });

    this.worker.on('stalled', (jobId: string) => {
      logger.warn('Job stalled', { jobId });
    });

    this.worker.on('error', (err: Error) => {
      logger.error('Worker error', err);
    });

    logger.info('✅ Job Processor initialized', {
      concurrency: 5,
      queue: 'coask-jobs',
    });
  }

  /**
   * Process a job
   */
  private async processJob(job: Job<JobData>): Promise<JobProcessingResult> {
    const startTime = Date.now();
    const { type, userId, payload } = job.data;

    logger.info('Processing job', {
      jobId: job.id,
      jobType: type,
      userId,
    });

    try {
      let result: any;

      switch (type) {
        case JobType.WORKFLOW_EXECUTION:
          result = await this.executeWorkflow(userId, payload);
          break;

        case JobType.RESEARCH_TASK:
          result = await this.executeAgentTask('research', payload.taskType, userId, payload);
          break;

        case JobType.EMAIL_DRAFT:
          result = await this.executeAgentTask('email', 'email.draft', userId, payload);
          break;

        case JobType.EMAIL_SEND:
          result = await this.executeAgentTask('email', 'email.send', userId, payload);
          break;

        case JobType.CALENDAR_EVENT:
          result = await this.executeAgentTask('calendar', 'calendar.create_event', userId, payload);
          break;

        case JobType.CALENDAR_REMINDER:
          result = await this.executeAgentTask('calendar', 'calendar.create_reminder', userId, payload);
          break;

        case JobType.KNOWLEDGE_INGEST:
          result = await this.ingestKnowledge(userId, payload);
          break;

        case JobType.HEALTH_CHECK:
          result = await this.performHealthCheck();
          break;

        default:
          throw new Error(`Unsupported job type: ${type}`);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        output: result,
        executionTime,
        metadata: {
          jobId: job.id,
          attempts: job.attemptsMade,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error('Job processing error', error, {
        jobId: job.id,
        jobType: type,
      });

      return {
        success: false,
        error: error.message,
        executionTime,
        metadata: {
          jobId: job.id,
          attempts: job.attemptsMade,
        },
      };
    }
  }

  /**
   * Execute a workflow
   */
  private async executeWorkflow(userId: string, payload: any): Promise<any> {
    const { workflowName, input } = payload;

    const workflow = getWorkflow(workflowName);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowName}`);
    }

    const result = await agentOrchestrator.executeWorkflow(workflow, userId, input);

    if (!result.success) {
      throw new Error(result.error || 'Workflow execution failed');
    }

    return result;
  }

  /**
   * Execute an agent task
   */
  private async executeAgentTask(
    agentType: string,
    taskType: string,
    userId: string,
    payload: any
  ): Promise<any> {
    const agent = agentRegistry.getAgent(agentType);
    if (!agent) {
      throw new Error(`Agent not found: ${agentType}`);
    }

    const task: AgentTask = {
      id: this.generateTaskId(),
      type: taskType,
      input: payload,
      context: {
        userId,
        conversationId: `job_${Date.now()}`,
      },
      createdAt: new Date(),
    };

    const result = await agent.execute(task);

    if (!result.success) {
      throw new Error(result.error || 'Agent task failed');
    }

    return result;
  }

  /**
   * Ingest knowledge into RAG pipeline
   */
  private async ingestKnowledge(userId: string, payload: any): Promise<any> {
    // This will be implemented when RAG pipeline has batch ingest capability
    logger.info('Knowledge ingest job', { userId, payload });

    return {
      message: 'Knowledge ingest functionality will be available in future release',
      userId,
      payload,
    };
  }

  /**
   * Perform system health check
   */
  private async performHealthCheck(): Promise<any> {
    logger.info('Performing system health check');

    const agentHealth = await agentRegistry.checkHealth();
    const queueMetrics = await jobQueue.getMetrics();

    const allHealthy = Object.values(agentHealth).every((status) => status === true);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      agents: agentHealth,
      queue: queueMetrics,
    };
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Pause job processing
   */
  async pause(): Promise<void> {
    await this.worker.pause();
    logger.info('Job processor paused');
  }

  /**
   * Resume job processing
   */
  async resume(): Promise<void> {
    await this.worker.resume();
    logger.info('Job processor resumed');
  }

  /**
   * Get worker status
   */
  isRunning(): boolean {
    return this.worker.isRunning();
  }

  isPaused(): boolean {
    return this.worker.isPaused();
  }

  /**
   * Close the worker
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.redisConnection.quit();
    logger.info('Job processor closed');
  }

  /**
   * Get the underlying worker
   */
  getWorker(): Worker {
    return this.worker;
  }
}

// Export singleton instance
export const jobProcessor = new JobProcessor();
