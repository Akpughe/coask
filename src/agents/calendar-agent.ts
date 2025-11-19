import { BaseAgent, AgentCapability, AgentTask, AgentContext } from './base-agent';
import { logger } from '../utils/logger';
import { jobQueue, JobType } from '../queue/job-queue';

/**
 * Calendar task types
 */
export enum CalendarTaskType {
  CREATE_EVENT = 'calendar.create_event',
  CREATE_REMINDER = 'calendar.create_reminder',
  LIST_EVENTS = 'calendar.list_events',
  UPDATE_EVENT = 'calendar.update_event',
  DELETE_EVENT = 'calendar.delete_event',
  FIND_FREE_SLOTS = 'calendar.find_free_slots',
}

/**
 * Event priority levels
 */
export enum EventPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Reminder types
 */
export enum ReminderType {
  EMAIL = 'email',
  NOTIFICATION = 'notification',
  BOTH = 'both',
}

/**
 * Event interface
 */
export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  priority: EventPriority;
  reminders?: {
    type: ReminderType;
    minutesBefore: number;
  }[];
  recurring?: {
    pattern: string; // cron expression
    endDate?: Date;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create event request
 */
export interface CreateEventRequest {
  userId: string;
  title: string;
  description?: string;
  startTime: Date | string;
  endTime: Date | string;
  location?: string;
  attendees?: string[];
  priority?: EventPriority;
  reminders?: {
    type: ReminderType;
    minutesBefore: number;
  }[];
  recurring?: {
    pattern: string;
    endDate?: Date | string;
  };
}

/**
 * Create reminder request
 */
export interface CreateReminderRequest {
  userId: string;
  message: string;
  remindAt: Date | string;
  type?: ReminderType;
  priority?: EventPriority;
  recurring?: {
    pattern: string;
    endDate?: Date | string;
  };
}

/**
 * List events request
 */
export interface ListEventsRequest {
  userId: string;
  startDate?: Date | string;
  endDate?: Date | string;
  priority?: EventPriority;
  limit?: number;
}

/**
 * Find free slots request
 */
export interface FindFreeSlotsRequest {
  userId: string;
  startDate: Date | string;
  endDate: Date | string;
  durationMinutes: number;
  workingHoursOnly?: boolean;
}

/**
 * Calendar Agent
 * Manages calendar events, reminders, and scheduling
 */
export class CalendarAgent extends BaseAgent {
  // In-memory event storage (would be replaced with database in production)
  private events: Map<string, CalendarEvent> = new Map();

  constructor() {
    super(
      'Calendar Agent',
      'calendar',
      'AI agent for managing calendar events, reminders, and scheduling'
    );
  }

  /**
   * Get agent capabilities
   */
  protected getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'create_event',
        description: 'Create calendar events with reminders and recurrence',
        parameters: {
          title: 'string (required)',
          description: 'string (optional)',
          startTime: 'date (required)',
          endTime: 'date (required)',
          location: 'string (optional)',
          priority: 'low | medium | high | urgent',
          recurring: 'cron pattern (optional)',
        },
      },
      {
        name: 'create_reminder',
        description: 'Create standalone reminders',
        parameters: {
          message: 'string (required)',
          remindAt: 'date (required)',
          type: 'email | notification | both',
          recurring: 'cron pattern (optional)',
        },
      },
      {
        name: 'list_events',
        description: 'List calendar events within a date range',
        parameters: {
          startDate: 'date (optional)',
          endDate: 'date (optional)',
          priority: 'low | medium | high | urgent (optional)',
        },
      },
      {
        name: 'find_free_slots',
        description: 'Find available time slots for scheduling',
        parameters: {
          startDate: 'date (required)',
          endDate: 'date (required)',
          durationMinutes: 'number (required)',
          workingHoursOnly: 'boolean (optional)',
        },
      },
    ];
  }

  /**
   * Get supported task types
   */
  protected getSupportedTaskTypes(): string[] {
    return Object.values(CalendarTaskType);
  }

  /**
   * Execute task
   */
  protected async executeTask(task: AgentTask): Promise<any> {
    switch (task.type) {
      case CalendarTaskType.CREATE_EVENT:
        return await this.createEvent(task.input as CreateEventRequest, task.context);

      case CalendarTaskType.CREATE_REMINDER:
        return await this.createReminder(task.input as CreateReminderRequest, task.context);

      case CalendarTaskType.LIST_EVENTS:
        return await this.listEvents(task.input as ListEventsRequest, task.context);

      case CalendarTaskType.FIND_FREE_SLOTS:
        return await this.findFreeSlots(task.input as FindFreeSlotsRequest, task.context);

      case CalendarTaskType.UPDATE_EVENT:
        return await this.updateEvent(task.input, task.context);

      case CalendarTaskType.DELETE_EVENT:
        return await this.deleteEvent(task.input, task.context);

      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  /**
   * Create a calendar event
   */
  private async createEvent(
    request: CreateEventRequest,
    context: AgentContext
  ): Promise<CalendarEvent> {
    logger.info('Creating calendar event', {
      userId: request.userId,
      title: request.title,
    });

    // Validate dates
    const startTime = new Date(request.startTime);
    const endTime = new Date(request.endTime);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new Error('Invalid date format');
    }

    if (startTime >= endTime) {
      throw new Error('End time must be after start time');
    }

    // Check for conflicts
    const conflicts = await this.checkConflicts(request.userId, startTime, endTime);
    if (conflicts.length > 0) {
      logger.warn('Event conflicts detected', {
        conflicts: conflicts.map((e) => e.title),
      });
    }

    // Create event
    const event: CalendarEvent = {
      id: this.generateEventId(),
      userId: request.userId,
      title: request.title,
      description: request.description,
      startTime,
      endTime,
      location: request.location,
      attendees: request.attendees,
      priority: request.priority || EventPriority.MEDIUM,
      reminders: request.reminders,
      recurring: request.recurring
        ? {
            pattern: request.recurring.pattern,
            endDate: request.recurring.endDate ? new Date(request.recurring.endDate) : undefined,
          }
        : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store event
    this.events.set(event.id, event);

    // Schedule reminders
    if (request.reminders && request.reminders.length > 0) {
      await this.scheduleReminders(event);
    }

    // Schedule recurring events
    if (request.recurring) {
      await this.scheduleRecurringEvent(event);
    }

    logger.info('Calendar event created', {
      eventId: event.id,
      title: event.title,
    });

    return event;
  }

  /**
   * Create a reminder
   */
  private async createReminder(
    request: CreateReminderRequest,
    context: AgentContext
  ): Promise<any> {
    logger.info('Creating reminder', {
      userId: request.userId,
      message: request.message,
    });

    const remindAt = new Date(request.remindAt);

    if (isNaN(remindAt.getTime())) {
      throw new Error('Invalid reminder date');
    }

    if (remindAt <= new Date()) {
      throw new Error('Reminder time must be in the future');
    }

    // Create reminder as a special event
    const reminder: CalendarEvent = {
      id: this.generateEventId(),
      userId: request.userId,
      title: 'Reminder',
      description: request.message,
      startTime: remindAt,
      endTime: remindAt,
      priority: request.priority || EventPriority.MEDIUM,
      reminders: [
        {
          type: request.type || ReminderType.NOTIFICATION,
          minutesBefore: 0,
        },
      ],
      recurring: request.recurring
        ? {
            pattern: request.recurring.pattern,
            endDate: request.recurring.endDate ? new Date(request.recurring.endDate) : undefined,
          }
        : undefined,
      metadata: {
        isReminder: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.events.set(reminder.id, reminder);

    // Schedule the reminder
    const delay = remindAt.getTime() - Date.now();

    if (request.recurring) {
      await jobQueue.scheduleRecurringJob(
        JobType.CALENDAR_REMINDER,
        request.userId,
        { message: request.message, type: request.type },
        {
          jobId: `reminder_${reminder.id}`,
          cron: request.recurring.pattern,
          endDate: request.recurring.endDate ? new Date(request.recurring.endDate) : undefined,
        }
      );
    } else {
      await jobQueue.addJob(JobType.CALENDAR_REMINDER, request.userId, {
        message: request.message,
        type: request.type,
      }, {
        delay,
        jobId: `reminder_${reminder.id}`,
      });
    }

    logger.info('Reminder scheduled', {
      reminderId: reminder.id,
      remindAt: remindAt.toISOString(),
    });

    return {
      reminder,
      scheduledAt: remindAt,
    };
  }

  /**
   * List events
   */
  private async listEvents(request: ListEventsRequest, context: AgentContext): Promise<any> {
    logger.info('Listing events', { userId: request.userId });

    let events = Array.from(this.events.values()).filter((e) => e.userId === request.userId);

    // Filter by date range
    if (request.startDate) {
      const startDate = new Date(request.startDate);
      events = events.filter((e) => e.startTime >= startDate);
    }

    if (request.endDate) {
      const endDate = new Date(request.endDate);
      events = events.filter((e) => e.endTime <= endDate);
    }

    // Filter by priority
    if (request.priority) {
      events = events.filter((e) => e.priority === request.priority);
    }

    // Sort by start time
    events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Apply limit
    if (request.limit) {
      events = events.slice(0, request.limit);
    }

    return {
      events,
      count: events.length,
    };
  }

  /**
   * Find free slots
   */
  private async findFreeSlots(
    request: FindFreeSlotsRequest,
    context: AgentContext
  ): Promise<any> {
    logger.info('Finding free slots', {
      userId: request.userId,
      durationMinutes: request.durationMinutes,
    });

    const startDate = new Date(request.startDate);
    const endDate = new Date(request.endDate);

    // Get all events in the date range
    const events = Array.from(this.events.values())
      .filter((e) => e.userId === request.userId)
      .filter((e) => e.endTime >= startDate && e.startTime <= endDate)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Find gaps between events
    const freeSlots: { start: Date; end: Date; durationMinutes: number }[] = [];
    let currentTime = startDate;

    for (const event of events) {
      if (currentTime < event.startTime) {
        const gapDuration = (event.startTime.getTime() - currentTime.getTime()) / (1000 * 60);

        if (gapDuration >= request.durationMinutes) {
          // Apply working hours filter if requested
          if (!request.workingHoursOnly || this.isWorkingHours(currentTime)) {
            freeSlots.push({
              start: currentTime,
              end: event.startTime,
              durationMinutes: gapDuration,
            });
          }
        }
      }

      currentTime = event.endTime > currentTime ? event.endTime : currentTime;
    }

    // Check if there's a gap after the last event
    if (currentTime < endDate) {
      const gapDuration = (endDate.getTime() - currentTime.getTime()) / (1000 * 60);

      if (gapDuration >= request.durationMinutes) {
        if (!request.workingHoursOnly || this.isWorkingHours(currentTime)) {
          freeSlots.push({
            start: currentTime,
            end: endDate,
            durationMinutes: gapDuration,
          });
        }
      }
    }

    return {
      freeSlots,
      count: freeSlots.length,
      requestedDuration: request.durationMinutes,
    };
  }

  /**
   * Update event
   */
  private async updateEvent(request: any, context: AgentContext): Promise<CalendarEvent> {
    const event = this.events.get(request.eventId);

    if (!event) {
      throw new Error('Event not found');
    }

    if (event.userId !== request.userId) {
      throw new Error('Unauthorized');
    }

    // Update fields
    if (request.title) event.title = request.title;
    if (request.description !== undefined) event.description = request.description;
    if (request.startTime) event.startTime = new Date(request.startTime);
    if (request.endTime) event.endTime = new Date(request.endTime);
    if (request.location !== undefined) event.location = request.location;
    if (request.priority) event.priority = request.priority;
    event.updatedAt = new Date();

    this.events.set(event.id, event);

    logger.info('Event updated', { eventId: event.id });

    return event;
  }

  /**
   * Delete event
   */
  private async deleteEvent(request: any, context: AgentContext): Promise<boolean> {
    const event = this.events.get(request.eventId);

    if (!event) {
      throw new Error('Event not found');
    }

    if (event.userId !== request.userId) {
      throw new Error('Unauthorized');
    }

    this.events.delete(request.eventId);

    // Remove scheduled jobs
    if (event.recurring) {
      await jobQueue.removeRepeatableJob(`event_${event.id}`, event.recurring.pattern);
    }

    logger.info('Event deleted', { eventId: event.id });

    return true;
  }

  /**
   * Check for event conflicts
   */
  private async checkConflicts(
    userId: string,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent[]> {
    return Array.from(this.events.values()).filter(
      (e) =>
        e.userId === userId &&
        ((startTime >= e.startTime && startTime < e.endTime) ||
          (endTime > e.startTime && endTime <= e.endTime) ||
          (startTime <= e.startTime && endTime >= e.endTime))
    );
  }

  /**
   * Schedule reminders for an event
   */
  private async scheduleReminders(event: CalendarEvent): Promise<void> {
    if (!event.reminders) return;

    for (const reminder of event.reminders) {
      const reminderTime = new Date(event.startTime.getTime() - reminder.minutesBefore * 60 * 1000);
      const delay = reminderTime.getTime() - Date.now();

      if (delay > 0) {
        await jobQueue.addJob(
          JobType.CALENDAR_REMINDER,
          event.userId,
          {
            eventId: event.id,
            eventTitle: event.title,
            reminderType: reminder.type,
          },
          {
            delay,
            jobId: `reminder_${event.id}_${reminder.minutesBefore}`,
          }
        );
      }
    }
  }

  /**
   * Schedule recurring event
   */
  private async scheduleRecurringEvent(event: CalendarEvent): Promise<void> {
    if (!event.recurring) return;

    await jobQueue.scheduleRecurringJob(
      JobType.CALENDAR_EVENT,
      event.userId,
      {
        eventId: event.id,
        title: event.title,
        description: event.description,
      },
      {
        jobId: `event_${event.id}`,
        cron: event.recurring.pattern,
        endDate: event.recurring.endDate,
      }
    );
  }

  /**
   * Check if time is within working hours (9 AM - 5 PM weekdays)
   */
  private isWorkingHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay();

    // Check if weekday (1-5) and between 9 AM and 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get execution metadata
   */
  protected getExecutionMetadata(task: AgentTask, output: any): Record<string, any> {
    return {
      taskType: task.type,
      eventId: output.id || output.eventId,
      recurring: output.recurring !== undefined,
    };
  }
}

// Export singleton instance
export const calendarAgent = new CalendarAgent();
