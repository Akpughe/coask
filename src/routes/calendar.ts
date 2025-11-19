import express, { Router, Request, Response } from 'express';
import { calendarAgent, CalendarTaskType } from '../agents/calendar-agent';
import { AgentTask } from '../agents/base-agent';
import { logger } from '../utils/logger';

const router: Router = express.Router();

/**
 * POST /calendar/events
 * Create a calendar event
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { userId, title, description, startTime, endTime, location, attendees, priority, reminders, recurring } =
      req.body;

    if (!userId || !title || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId, title, startTime, and endTime are required',
      });
    }

    logger.info('POST /calendar/events', { userId, title });

    const task: AgentTask = {
      id: `task_${Date.now()}`,
      type: CalendarTaskType.CREATE_EVENT,
      input: { userId, title, description, startTime, endTime, location, attendees, priority, reminders, recurring },
      context: { userId },
      createdAt: new Date(),
    };

    const result = await calendarAgent.execute(task);

    if (!result.success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: result.error || 'Failed to create event',
      });
    }

    res.json({
      success: true,
      data: result.output,
    });
  } catch (error: any) {
    logger.error('Error creating event', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to create event',
    });
  }
});

/**
 * GET /calendar/events
 * List calendar events
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, priority, limit } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required',
      });
    }

    logger.info('GET /calendar/events', { userId });

    const task: AgentTask = {
      id: `task_${Date.now()}`,
      type: CalendarTaskType.LIST_EVENTS,
      input: {
        userId: userId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        priority: priority as string | undefined,
        limit: limit ? Number(limit) : undefined,
      },
      context: { userId: userId as string },
      createdAt: new Date(),
    };

    const result = await calendarAgent.execute(task);

    if (!result.success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: result.error || 'Failed to list events',
      });
    }

    res.json({
      success: true,
      data: result.output,
    });
  } catch (error: any) {
    logger.error('Error listing events', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to list events',
    });
  }
});

/**
 * POST /calendar/reminders
 * Create a reminder
 */
router.post('/reminders', async (req: Request, res: Response) => {
  try {
    const { userId, message, remindAt, type, priority, recurring } = req.body;

    if (!userId || !message || !remindAt) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId, message, and remindAt are required',
      });
    }

    logger.info('POST /calendar/reminders', { userId, message });

    const task: AgentTask = {
      id: `task_${Date.now()}`,
      type: CalendarTaskType.CREATE_REMINDER,
      input: { userId, message, remindAt, type, priority, recurring },
      context: { userId },
      createdAt: new Date(),
    };

    const result = await calendarAgent.execute(task);

    if (!result.success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: result.error || 'Failed to create reminder',
      });
    }

    res.json({
      success: true,
      data: result.output,
    });
  } catch (error: any) {
    logger.error('Error creating reminder', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to create reminder',
    });
  }
});

/**
 * POST /calendar/free-slots
 * Find free time slots
 */
router.post('/free-slots', async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, durationMinutes, workingHoursOnly } = req.body;

    if (!userId || !startDate || !endDate || !durationMinutes) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId, startDate, endDate, and durationMinutes are required',
      });
    }

    logger.info('POST /calendar/free-slots', { userId, durationMinutes });

    const task: AgentTask = {
      id: `task_${Date.now()}`,
      type: CalendarTaskType.FIND_FREE_SLOTS,
      input: { userId, startDate, endDate, durationMinutes, workingHoursOnly },
      context: { userId },
      createdAt: new Date(),
    };

    const result = await calendarAgent.execute(task);

    if (!result.success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: result.error || 'Failed to find free slots',
      });
    }

    res.json({
      success: true,
      data: result.output,
    });
  } catch (error: any) {
    logger.error('Error finding free slots', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to find free slots',
    });
  }
});

/**
 * PUT /calendar/events/:eventId
 * Update a calendar event
 */
router.put('/events/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { userId, title, description, startTime, endTime, location, priority } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required',
      });
    }

    logger.info('PUT /calendar/events/:eventId', { eventId, userId });

    const task: AgentTask = {
      id: `task_${Date.now()}`,
      type: CalendarTaskType.UPDATE_EVENT,
      input: { eventId, userId, title, description, startTime, endTime, location, priority },
      context: { userId },
      createdAt: new Date(),
    };

    const result = await calendarAgent.execute(task);

    if (!result.success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: result.error || 'Failed to update event',
      });
    }

    res.json({
      success: true,
      data: result.output,
    });
  } catch (error: any) {
    logger.error('Error updating event', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to update event',
    });
  }
});

/**
 * DELETE /calendar/events/:eventId
 * Delete a calendar event
 */
router.delete('/events/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required',
      });
    }

    logger.info('DELETE /calendar/events/:eventId', { eventId, userId });

    const task: AgentTask = {
      id: `task_${Date.now()}`,
      type: CalendarTaskType.DELETE_EVENT,
      input: { eventId, userId },
      context: { userId: userId as string },
      createdAt: new Date(),
    };

    const result = await calendarAgent.execute(task);

    if (!result.success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: result.error || 'Failed to delete event',
      });
    }

    res.json({
      success: true,
      data: {
        eventId,
        deleted: result.output,
      },
    });
  } catch (error: any) {
    logger.error('Error deleting event', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to delete event',
    });
  }
});

export default router;
