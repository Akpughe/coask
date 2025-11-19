import { Queue, QueueOptions, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../core/config';
import { logger } from '../utils/logger';
import { CronExpressionParser } from 'cron-parser';

/**
 * Job types supported by the queue system
 */
export enum JobType {
  // Workflow Jobs
  WORKFLOW_EXECUTION = 'workflow.execute',

  // Agent Jobs
  RESEARCH_TASK = 'agent.research',
  EMAIL_DRAFT = 'agent.email.draft',
  EMAIL_SEND = 'agent.email.send',
  CALENDAR_EVENT = 'agent.calendar.event',
  CALENDAR_REMINDER = 'agent.calendar.reminder',

  // Knowledge Base Jobs
  KNOWLEDGE_INGEST = 'knowledge.ingest',
  KNOWLEDGE_CLEANUP = 'knowledge.cleanup',

  // System Jobs
  HEALTH_CHECK = 'system.health_check',
  DATA_BACKUP = 'system.backup',
}

/**
 * Job data structure
 */
export interface JobData {
  type: JobType;
  userId: string;
  payload: any;
  metadata?: {
    source?: string;
    priority?: number;
    retryCount?: number;
    [key: string]: any;
  };
}

/**
 * Schedule options for recurring jobs
 */
export interface ScheduleOptions {
  jobId?: string;
  cron?: string;
  every?: number; // milliseconds
  startDate?: Date;
  endDate?: Date;
  repeat?: {
    pattern: string;
    limit?: number;
  };
  priority?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
}

/**
 * Job Queue Manager
 * Manages job scheduling, execution, and monitoring using BullMQ
 */
export class JobQueueManager {
  private queue: Queue;
  private redisConnection: Redis;

  constructor() {
    // Create Redis connection for BullMQ
    this.redisConnection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    // Create BullMQ queue
    const queueOptions: QueueOptions = {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    };

    this.queue = new Queue('coask-jobs', queueOptions);

    logger.info('✅ Job Queue Manager initialized', {
      redisUrl: config.redisUrl,
      queue: 'coask-jobs',
    });
  }

  /**
   * Add a one-time job to the queue
   */
  async addJob(
    jobType: JobType,
    userId: string,
    payload: any,
    options?: {
      delay?: number;
      priority?: number;
      jobId?: string;
    }
  ): Promise<Job> {
    const jobData: JobData = {
      type: jobType,
      userId,
      payload,
      metadata: {
        source: 'api',
        priority: options?.priority || 0,
        retryCount: 0,
      },
    };

    const job = await this.queue.add(jobType, jobData, {
      delay: options?.delay,
      priority: options?.priority,
      jobId: options?.jobId,
    });

    logger.info('Job added to queue', {
      jobId: job.id,
      jobType,
      userId,
    });

    return job;
  }

  /**
   * Schedule a recurring job
   */
  async scheduleRecurringJob(
    jobType: JobType,
    userId: string,
    payload: any,
    scheduleOptions: ScheduleOptions
  ): Promise<Job> {
    const jobData: JobData = {
      type: jobType,
      userId,
      payload,
      metadata: {
        source: 'scheduler',
        priority: scheduleOptions.priority || 0,
        retryCount: 0,
        cron: scheduleOptions.cron,
        every: scheduleOptions.every,
      },
    };

    // Validate cron expression if provided
    if (scheduleOptions.cron) {
      try {
        const interval = CronExpressionParser.parse(scheduleOptions.cron);
        logger.debug('Cron expression parsed successfully', {
          cron: scheduleOptions.cron,
          nextRun: interval.next().toDate(),
        });
      } catch (error: any) {
        logger.error('Invalid cron expression', error);
        throw new Error(`Invalid cron expression: ${scheduleOptions.cron}`);
      }
    }

    // Build repeat options
    const repeatOptions: any = {};

    if (scheduleOptions.cron) {
      repeatOptions.pattern = scheduleOptions.cron;
    } else if (scheduleOptions.every) {
      repeatOptions.every = scheduleOptions.every;
    } else {
      throw new Error('Either cron or every must be specified for recurring jobs');
    }

    if (scheduleOptions.startDate) {
      repeatOptions.startDate = scheduleOptions.startDate;
    }
    if (scheduleOptions.endDate) {
      repeatOptions.endDate = scheduleOptions.endDate;
    }
    if (scheduleOptions.repeat?.limit) {
      repeatOptions.limit = scheduleOptions.repeat.limit;
    }

    const job = await this.queue.add(jobType, jobData, {
      jobId: scheduleOptions.jobId,
      priority: scheduleOptions.priority,
      repeat: repeatOptions,
      attempts: scheduleOptions.attempts,
      backoff: scheduleOptions.backoff,
    });

    logger.info('Recurring job scheduled', {
      jobId: job.id,
      jobType,
      userId,
      cron: scheduleOptions.cron,
      every: scheduleOptions.every,
    });

    return job;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | undefined> {
    return await this.queue.getJob(jobId);
  }

  /**
   * Get jobs by state
   */
  async getJobs(
    state: 'active' | 'waiting' | 'completed' | 'failed' | 'delayed' | 'paused',
    start = 0,
    end = 10
  ): Promise<Job[]> {
    return await this.queue.getJobs([state], start, end);
  }

  /**
   * Get all jobs for a user
   */
  async getJobsByUser(userId: string, limit = 50): Promise<Job[]> {
    const jobs = await this.queue.getJobs(['active', 'waiting', 'completed', 'failed', 'delayed'], 0, 1000);
    return jobs.filter((job) => (job.data as JobData).userId === userId).slice(0, limit);
  }

  /**
   * Remove a job
   */
  async removeJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) {
      return false;
    }

    await job.remove();
    logger.info('Job removed', { jobId });
    return true;
  }

  /**
   * Remove a repeatable job
   */
  async removeRepeatableJob(jobId: string, cron?: string, every?: number): Promise<boolean> {
    try {
      let removed = false;

      if (cron) {
        removed = await this.queue.removeRepeatable(jobId, { pattern: cron });
      } else if (every) {
        removed = await this.queue.removeRepeatable(jobId, { every });
      } else {
        // Try to find the job and get its repeat options
        const job = await this.getJob(jobId);
        if (job && job.opts.repeat) {
          removed = await this.queue.removeRepeatable(jobId, job.opts.repeat);
        }
      }

      if (removed) {
        logger.info('Repeatable job removed', { jobId });
      }

      return removed;
    } catch (error: any) {
      logger.error('Error removing repeatable job', error);
      return false;
    }
  }

  /**
   * Get all repeatable jobs
   */
  async getRepeatableJobs(): Promise<any[]> {
    return await this.queue.getRepeatableJobs();
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Queue resumed');
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Clean old jobs
   */
  async cleanJobs(
    grace: number = 24 * 3600 * 1000,
    limit: number = 1000
  ): Promise<{ completed: number; failed: number }> {
    const [completed, failed] = await Promise.all([
      this.queue.clean(grace, limit, 'completed'),
      this.queue.clean(grace * 7, limit, 'failed'), // Keep failed jobs longer
    ]);

    logger.info('Jobs cleaned', {
      completedCleaned: completed.length,
      failedCleaned: failed.length,
    });

    return {
      completed: completed.length,
      failed: failed.length,
    };
  }

  /**
   * Obliterate the queue (remove all jobs and queue data)
   * Use with caution!
   */
  async obliterate(): Promise<void> {
    await this.queue.obliterate({ force: true });
    logger.warn('Queue obliterated - all jobs removed');
  }

  /**
   * Close the queue and Redis connection
   */
  async close(): Promise<void> {
    await this.queue.close();
    await this.redisConnection.quit();
    logger.info('Job Queue Manager closed');
  }

  /**
   * Get the underlying BullMQ queue
   */
  getQueue(): Queue {
    return this.queue;
  }
}

// Export singleton instance
export const jobQueue = new JobQueueManager();
