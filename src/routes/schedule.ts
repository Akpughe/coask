import express, { Router, Request, Response } from 'express';
import { jobQueue, JobType, ScheduleOptions } from '../queue/job-queue';
import { calendarAgent } from '../agents/calendar-agent';
import { agentRegistry } from '../agents/base-agent';
import { logger } from '../utils/logger';
import { CronExpressionParser } from 'cron-parser';

const router: Router = express.Router();

/**
 * POST /schedule/job
 * Schedule a one-time job
 */
router.post('/job', async (req: Request, res: Response) => {
  try {
    const { jobType, userId, payload, delay, priority } = req.body;

    if (!jobType || !userId || !payload) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'jobType, userId, and payload are required',
      });
    }

    logger.info('POST /schedule/job', { jobType, userId });

    const job = await jobQueue.addJob(jobType as JobType, userId, payload, {
      delay,
      priority,
    });

    res.json({
      success: true,
      data: {
        jobId: job.id,
        jobType,
        userId,
        delay,
        scheduledFor: delay ? new Date(Date.now() + delay).toISOString() : 'immediate',
      },
    });
  } catch (error: any) {
    logger.error('Error scheduling job', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to schedule job',
    });
  }
});

/**
 * POST /schedule/recurring
 * Schedule a recurring job
 */
router.post('/recurring', async (req: Request, res: Response) => {
  try {
    const { jobType, userId, payload, cron, every, startDate, endDate, priority } = req.body;

    if (!jobType || !userId || !payload) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'jobType, userId, and payload are required',
      });
    }

    if (!cron && !every) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Either cron or every must be specified',
      });
    }

    logger.info('POST /schedule/recurring', { jobType, userId, cron, every });

    // Calculate next run time
    let nextRun: Date | undefined;
    if (cron) {
      try {
        const interval = CronExpressionParser.parse(cron);
        nextRun = interval.next().toDate();
      } catch (error: any) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid cron expression: ${error.message}`,
        });
      }
    } else if (every) {
      nextRun = new Date(Date.now() + every);
    }

    const scheduleOptions: ScheduleOptions = {
      cron,
      every,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      priority,
    };

    const job = await jobQueue.scheduleRecurringJob(
      jobType as JobType,
      userId,
      payload,
      scheduleOptions
    );

    res.json({
      success: true,
      data: {
        jobId: job.id,
        jobType,
        userId,
        cron,
        every,
        nextRun: nextRun?.toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
      },
    });
  } catch (error: any) {
    logger.error('Error scheduling recurring job', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to schedule recurring job',
    });
  }
});

/**
 * POST /schedule/workflow
 * Schedule a workflow execution
 */
router.post('/workflow', async (req: Request, res: Response) => {
  try {
    const { workflowName, userId, input, cron, delay } = req.body;

    if (!workflowName || !userId || !input) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'workflowName, userId, and input are required',
      });
    }

    logger.info('POST /schedule/workflow', { workflowName, userId, cron, delay });

    const payload = { workflowName, input };

    let job;
    if (cron) {
      // Recurring workflow
      job = await jobQueue.scheduleRecurringJob(
        JobType.WORKFLOW_EXECUTION,
        userId,
        payload,
        { cron }
      );
    } else {
      // One-time workflow
      job = await jobQueue.addJob(JobType.WORKFLOW_EXECUTION, userId, payload, { delay });
    }

    res.json({
      success: true,
      data: {
        jobId: job.id,
        workflowName,
        userId,
        cron,
        delay,
        scheduledFor: delay
          ? new Date(Date.now() + delay).toISOString()
          : cron
          ? 'recurring'
          : 'immediate',
      },
    });
  } catch (error: any) {
    logger.error('Error scheduling workflow', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to schedule workflow',
    });
  }
});

/**
 * GET /schedule/jobs
 * Get scheduled jobs
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { state = 'waiting', start = 0, end = 10 } = req.query;

    logger.info('GET /schedule/jobs', { state });

    const validStates = ['active', 'waiting', 'completed', 'failed', 'delayed', 'paused'];
    if (!validStates.includes(state as string)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid state. Must be one of: ${validStates.join(', ')}`,
      });
    }

    const jobs = await jobQueue.getJobs(
      state as 'active' | 'waiting' | 'completed' | 'failed' | 'delayed' | 'paused',
      Number(start),
      Number(end)
    );

    const jobsData = await Promise.all(
      jobs.map(async (job) => ({
        id: job.id,
        type: job.name,
        data: job.data,
        state: await job.getState(),
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        timestamp: job.timestamp,
      }))
    );

    res.json({
      success: true,
      data: {
        jobs: jobsData,
        count: jobsData.length,
        state,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching jobs', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch jobs',
    });
  }
});

/**
 * GET /schedule/jobs/:jobId
 * Get job details
 */
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    logger.info('GET /schedule/jobs/:jobId', { jobId });

    const job = await jobQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Job not found: ${jobId}`,
      });
    }

    const jobData = {
      id: job.id,
      type: job.name,
      data: job.data,
      state: await job.getState(),
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      timestamp: job.timestamp,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      opts: job.opts,
    };

    res.json({
      success: true,
      data: jobData,
    });
  } catch (error: any) {
    logger.error('Error fetching job', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch job',
    });
  }
});

/**
 * DELETE /schedule/jobs/:jobId
 * Cancel/remove a job
 */
router.delete('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    logger.info('DELETE /schedule/jobs/:jobId', { jobId });

    const removed = await jobQueue.removeJob(jobId);

    if (!removed) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Job not found: ${jobId}`,
      });
    }

    res.json({
      success: true,
      data: {
        jobId,
        removed: true,
      },
    });
  } catch (error: any) {
    logger.error('Error removing job', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to remove job',
    });
  }
});

/**
 * GET /schedule/recurring
 * Get all repeatable/recurring jobs
 */
router.get('/recurring', async (req: Request, res: Response) => {
  try {
    logger.info('GET /schedule/recurring');

    const repeatableJobs = await jobQueue.getRepeatableJobs();

    res.json({
      success: true,
      data: {
        jobs: repeatableJobs,
        count: repeatableJobs.length,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching repeatable jobs', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch repeatable jobs',
    });
  }
});

/**
 * DELETE /schedule/recurring/:jobId
 * Remove a repeatable job
 */
router.delete('/recurring/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { cron, every } = req.query;

    logger.info('DELETE /schedule/recurring/:jobId', { jobId });

    const removed = await jobQueue.removeRepeatableJob(
      jobId,
      cron as string | undefined,
      every ? Number(every) : undefined
    );

    if (!removed) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Repeatable job not found: ${jobId}`,
      });
    }

    res.json({
      success: true,
      data: {
        jobId,
        removed: true,
      },
    });
  } catch (error: any) {
    logger.error('Error removing repeatable job', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to remove repeatable job',
    });
  }
});

/**
 * GET /schedule/metrics
 * Get queue metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    logger.info('GET /schedule/metrics');

    const metrics = await jobQueue.getMetrics();

    res.json({
      success: true,
      data: {
        ...metrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching metrics', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch metrics',
    });
  }
});

/**
 * POST /schedule/pause
 * Pause the queue
 */
router.post('/pause', async (req: Request, res: Response) => {
  try {
    logger.info('POST /schedule/pause');

    await jobQueue.pause();

    res.json({
      success: true,
      data: {
        status: 'paused',
      },
    });
  } catch (error: any) {
    logger.error('Error pausing queue', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to pause queue',
    });
  }
});

/**
 * POST /schedule/resume
 * Resume the queue
 */
router.post('/resume', async (req: Request, res: Response) => {
  try {
    logger.info('POST /schedule/resume');

    await jobQueue.resume();

    res.json({
      success: true,
      data: {
        status: 'active',
      },
    });
  } catch (error: any) {
    logger.error('Error resuming queue', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to resume queue',
    });
  }
});

/**
 * POST /schedule/clean
 * Clean old jobs
 */
router.post('/clean', async (req: Request, res: Response) => {
  try {
    const { gracePeriod = 24 * 3600 * 1000, limit = 1000 } = req.body;

    logger.info('POST /schedule/clean', { gracePeriod, limit });

    const result = await jobQueue.cleanJobs(Number(gracePeriod), Number(limit));

    res.json({
      success: true,
      data: {
        completedCleaned: result.completed,
        failedCleaned: result.failed,
        totalCleaned: result.completed + result.failed,
      },
    });
  } catch (error: any) {
    logger.error('Error cleaning jobs', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to clean jobs',
    });
  }
});

export default router;
