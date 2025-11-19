# Phase 4 Completion: Scheduling & Automation

**Status**: ✅ Complete
**Date**: November 19, 2025
**Duration**: ~3 hours

## Overview

Phase 4 adds comprehensive scheduling and automation capabilities to Coask, enabling time-based task execution, recurring workflows, and calendar event management. This phase introduces BullMQ for job queue management, a new Calendar Agent, and extensive scheduling APIs.

## What Was Implemented

### 1. Job Queue System (`src/queue/job-queue.ts`)

**Lines**: 407 lines
**Purpose**: Manage job scheduling, execution, and monitoring using BullMQ and Redis

**Key Features**:
- **Job Types**: 10 predefined job types including workflow execution, agent tasks, calendar events, and system jobs
- **One-time Jobs**: Schedule jobs with optional delays and priorities
- **Recurring Jobs**: Support for cron expressions and interval-based scheduling
- **Job Management**: Get, remove, pause, and resume jobs
- **Queue Metrics**: Monitor waiting, active, completed, failed, and delayed jobs
- **Auto-cleanup**: Configurable retention policies for completed and failed jobs

**Key Methods**:
```typescript
async addJob(jobType, userId, payload, options)
async scheduleRecurringJob(jobType, userId, payload, scheduleOptions)
async getJob(jobId)
async getJobs(state, start, end)
async removeJob(jobId)
async getMetrics()
async cleanJobs(grace, limit)
```

### 2. Job Processor (`src/queue/job-processor.ts`)

**Lines**: 261 lines
**Purpose**: Process queued jobs using BullMQ Worker

**Key Features**:
- **Concurrency**: Process up to 5 jobs concurrently
- **Rate Limiting**: Max 100 jobs per minute
- **Job Types Supported**: Workflow execution, research tasks, email operations, calendar events, knowledge ingestion, health checks
- **Event Handling**: Comprehensive logging for completed, failed, active, and stalled jobs
- **Error Recovery**: Automatic retry with exponential backoff

**Processing Flow**:
1. Worker receives job from queue
2. Routes to appropriate handler based on job type
3. Executes via agent registry or orchestrator
4. Returns result with execution metadata
5. Logs completion or failure

### 3. Calendar Agent (`src/agents/calendar-agent.ts`)

**Lines**: 624 lines
**Purpose**: Manage calendar events, reminders, and scheduling

**Extends**: `BaseAgent`
**Agent Type**: `calendar`

**Capabilities**:
- **Create Events**: Full calendar events with start/end times, attendees, location, priority, reminders, and recurrence
- **Create Reminders**: Standalone reminders with email/notification delivery
- **List Events**: Query events by date range and priority
- **Find Free Slots**: Identify available time slots for scheduling
- **Update/Delete Events**: Full event lifecycle management
- **Conflict Detection**: Check for scheduling conflicts
- **Recurring Events**: Support for cron-based recurring events

**Event Properties**:
```typescript
interface CalendarEvent {
  id: string
  userId: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  location?: string
  attendees?: string[]
  priority: EventPriority
  reminders?: { type: ReminderType; minutesBefore: number }[]
  recurring?: { pattern: string; endDate?: Date }
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
```

**Task Types**:
- `calendar.create_event`
- `calendar.create_reminder`
- `calendar.list_events`
- `calendar.find_free_slots`
- `calendar.update_event`
- `calendar.delete_event`

### 4. Schedule API Routes (`src/routes/schedule.ts`)

**Lines**: 383 lines
**Purpose**: RESTful API for job scheduling and queue management

**Endpoints**:

**Job Scheduling**:
- `POST /schedule/job` - Schedule a one-time job
- `POST /schedule/recurring` - Schedule a recurring job
- `POST /schedule/workflow` - Schedule workflow execution

**Job Management**:
- `GET /schedule/jobs?state={state}&start={start}&end={end}` - Get jobs by state
- `GET /schedule/jobs/:jobId` - Get job details
- `DELETE /schedule/jobs/:jobId` - Cancel/remove a job

**Recurring Jobs**:
- `GET /schedule/recurring` - List all recurring jobs
- `DELETE /schedule/recurring/:jobId` - Remove recurring job

**Queue Control**:
- `GET /schedule/metrics` - Get queue metrics
- `POST /schedule/pause` - Pause queue processing
- `POST /schedule/resume` - Resume queue processing
- `POST /schedule/clean` - Clean old jobs

**Example Request**:
```bash
curl -X POST http://localhost:3000/schedule/recurring \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "workflow.execute",
    "userId": "user123",
    "payload": {
      "workflowName": "research_and_email",
      "input": { "researchQuery": "AI trends" }
    },
    "cron": "0 9 * * 1"
  }'
```

### 5. Calendar API Routes (`src/routes/calendar.ts`)

**Lines**: 252 lines
**Purpose**: RESTful API for calendar and event management

**Endpoints**:

- `POST /calendar/events` - Create calendar event
- `GET /calendar/events?userId={userId}&startDate={date}&endDate={date}` - List events
- `POST /calendar/reminders` - Create reminder
- `POST /calendar/free-slots` - Find free time slots
- `PUT /calendar/events/:eventId` - Update event
- `DELETE /calendar/events/:eventId` - Delete event

**Example Request**:
```bash
curl -X POST http://localhost:3000/calendar/events \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "title": "Team Standup",
    "startTime": "2025-11-20T09:00:00Z",
    "endTime": "2025-11-20T09:30:00Z",
    "recurring": {
      "pattern": "0 9 * * 1-5"
    },
    "reminders": [
      { "type": "email", "minutesBefore": 15 }
    ]
  }'
```

### 6. Updated Files

**`src/core/startup.ts`**:
- Added calendar agent registration
- Added job processor initialization
- Added health check for job processor

**`src/index.ts`**:
- Added schedule router: `/schedule`
- Added calendar router: `/calendar`

## Dependencies Added

```json
{
  "bullmq": "5.63.2",
  "ioredis": "5.8.2",
  "cron-parser": "5.4.0"
}
```

**Total new packages**: 20

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Coask Application                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Schedule   │    │   Calendar   │    │    Queue     │  │
│  │     API      │    │     API      │    │  Management  │  │
│  │  (REST)      │    │  (REST)      │    │   (Metrics)  │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                    │          │
│         ├───────────────────┴────────────────────┤          │
│         │                                        │          │
│  ┌──────▼─────────────────────────────────┐     │          │
│  │         Job Queue Manager              │     │          │
│  │         (BullMQ + Redis)               │     │          │
│  │                                        │     │          │
│  │  • Schedule one-time jobs             │     │          │
│  │  • Schedule recurring jobs            │     │          │
│  │  • Manage job lifecycle               │     │          │
│  │  • Track metrics                      │     │          │
│  └────────────────┬───────────────────────┘     │          │
│                   │                              │          │
│            ┌──────▼──────────┐                   │          │
│            │   Job Processor  │◄──────────────────┘          │
│            │   (BullMQ Worker)│                              │
│            └──────┬───────────┘                              │
│                   │                                          │
│      ┌────────────┴─────────────┬──────────────────┐        │
│      │                          │                  │        │
│  ┌───▼────────┐      ┌──────────▼────┐    ┌───────▼──────┐ │
│  │  Workflow  │      │ Calendar Agent │    │ Other Agents │ │
│  │Orchestrator│      │                │    │ (Research,   │ │
│  │            │      │ • Events       │    │  Email, etc) │ │
│  └────────────┘      │ • Reminders    │    └──────────────┘ │
│                      │ • Conflicts    │                     │
│                      │ • Free Slots   │                     │
│                      └────────────────┘                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │
                     ┌────────▼─────────┐
                     │   Redis Server   │
                     │   (Queue Store)  │
                     └──────────────────┘
```

## Data Flow Example: Scheduled Weekly Research

```
1. User Request (API):
   POST /schedule/recurring
   {
     "jobType": "workflow.execute",
     "userId": "user123",
     "payload": {
       "workflowName": "research_and_email",
       "input": { "researchQuery": "AI trends" }
     },
     "cron": "0 9 * * 1"  // Every Monday at 9 AM
   }

2. Job Queue Manager:
   - Validates cron expression
   - Creates repeatable job in BullMQ
   - Returns job ID and next run time

3. BullMQ (every Monday 9 AM):
   - Enqueues job to "coask-jobs" queue
   - Notifies Job Processor

4. Job Processor:
   - Receives job from queue
   - Identifies type: WORKFLOW_EXECUTION
   - Calls AgentOrchestrator.executeWorkflow()

5. Agent Orchestrator:
   - Loads "research_and_email" workflow
   - Executes Step 1: Research Agent (web search)
   - Executes Step 2: Email Agent (draft email with findings)

6. Result:
   - Returns workflow result to Job Processor
   - Job marked as completed in queue
   - Next occurrence scheduled for following Monday
```

## Real-World Use Cases

### 1. Daily Report Generation
```typescript
// Schedule daily market research report at 8 AM
POST /schedule/recurring
{
  "jobType": "workflow.execute",
  "payload": {
    "workflowName": "research_and_email",
    "input": {
      "researchQuery": "stock market trends today",
      "emailTo": "team@company.com"
    }
  },
  "cron": "0 8 * * *"
}
```

### 2. Recurring Team Meetings
```typescript
// Create weekly standup with email reminder
POST /calendar/events
{
  "userId": "user123",
  "title": "Weekly Team Standup",
  "startTime": "2025-11-20T09:00:00Z",
  "endTime": "2025-11-20T09:30:00Z",
  "recurring": {
    "pattern": "0 9 * * 1"  // Every Monday at 9 AM
  },
  "reminders": [
    { "type": "email", "minutesBefore": 15 }
  ]
}
```

### 3. Smart Scheduling
```typescript
// Find next available 60-minute slot during working hours
POST /calendar/free-slots
{
  "userId": "user123",
  "startDate": "2025-11-20T00:00:00Z",
  "endDate": "2025-11-27T23:59:59Z",
  "durationMinutes": 60,
  "workingHoursOnly": true
}
```

### 4. Delayed Task Execution
```typescript
// Schedule one-time email to be sent in 2 hours
POST /schedule/job
{
  "jobType": "agent.email.send",
  "userId": "user123",
  "payload": {
    "to": "client@example.com",
    "subject": "Follow-up",
    "body": "..."
  },
  "delay": 7200000  // 2 hours in milliseconds
}
```

## Testing Results

### Build Status
```bash
$ pnpm run build
> tsc
✅ Build successful - 0 errors
```

### Server Startup
```bash
$ pnpm run dev
[INFO] ✅ Job Queue Manager initialized
[INFO] ✅ Calendar Agent initialized
[INFO] ✅ Job Processor initialized
[INFO] ✅ All agents registered
[INFO] ✅ Job processor is running
[INFO] 🚀 Coask server started
[INFO] 🌐 Server running on http://localhost:3000
```

### Agents Registered
- ✅ Research Agent
- ✅ Calendar Agent
- ✅ Job Processor (running with concurrency: 5)

### API Endpoints Available
- ✅ `/schedule/*` - Job scheduling and queue management
- ✅ `/calendar/*` - Event and reminder management
- ✅ `/orchestration/*` - Multi-agent workflows
- ✅ `/agents/*` - Direct agent execution
- ✅ `/knowledge/*` - RAG pipeline operations

## Technical Highlights

### Cron Expression Support
Uses `cron-parser` library for robust cron parsing:
```typescript
// Examples:
"0 9 * * 1-5"     // Weekdays at 9 AM
"0 */2 * * *"     // Every 2 hours
"0 0 1 * *"       // First day of every month
"@hourly"         // Every hour (predefined)
```

### Job Retry & Backoff
```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000  // 2s, 4s, 8s
  }
}
```

### Event Conflict Detection
Calendar Agent checks for scheduling conflicts:
```typescript
private async checkConflicts(userId, startTime, endTime): Promise<CalendarEvent[]> {
  // Returns overlapping events
}
```

### Working Hours Filter
```typescript
private isWorkingHours(date: Date): boolean {
  const hour = date.getHours();
  const day = date.getDay();
  return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
}
```

## Files Created

1. `src/queue/job-queue.ts` - 407 lines
2. `src/queue/job-processor.ts` - 261 lines
3. `src/agents/calendar-agent.ts` - 624 lines
4. `src/routes/schedule.ts` - 383 lines
5. `src/routes/calendar.ts` - 252 lines

**Total**: 1,927 new lines of code

## Files Modified

1. `src/core/startup.ts` - Added calendar agent and job processor initialization
2. `src/index.ts` - Added schedule and calendar routes

## Challenges & Solutions

### Challenge 1: Cron Parser API
**Issue**: Initial import `import { parseExpression } from 'cron-parser'` failed
**Solution**: Changed to `import { CronExpressionParser } from 'cron-parser'` and use `CronExpressionParser.parse()`

### Challenge 2: BullMQ getPausedCount
**Issue**: `queue.getPausedCount()` method doesn't exist in BullMQ 5.x
**Solution**: Removed paused count from metrics interface

### Challenge 3: Async Map in Route Handler
**Issue**: `jobs.map(async (job) => ({ state: await job.getState() }))` caused TypeScript error
**Solution**: Wrapped in `Promise.all()` to properly handle async mapping

## Production Considerations

### Redis Requirement
- Phase 4 requires Redis for BullMQ to function
- Graceful degradation: Server starts without Redis, but scheduling features unavailable
- Recommended: Use managed Redis (AWS ElastiCache, Redis Cloud, Upstash)

### Storage
- Calendar events currently stored in-memory (Map)
- Production: Replace with PostgreSQL or similar database
- Add persistence layer in `CalendarAgent`

### Scalability
- BullMQ supports horizontal scaling with multiple workers
- Each worker instance processes jobs concurrently
- Redis acts as central coordinator

### Monitoring
- Use `/schedule/metrics` for queue health
- Monitor job failure rates
- Set up alerts for stalled jobs

## Next Steps (Future Enhancements)

### Phase 5 Candidates:
1. **Persistent Calendar Storage**: Replace in-memory storage with PostgreSQL
2. **Advanced Scheduling**: Support for timezones, business hours, holiday calendars
3. **Webhook Integrations**: Trigger external services when events occur
4. **Calendar Sync**: Google Calendar, Outlook Calendar integration
5. **Job History UI**: Dashboard for visualizing job execution history
6. **Smart Retry Logic**: ML-based retry strategies based on failure patterns

## Conclusion

Phase 4 successfully adds enterprise-grade scheduling and automation capabilities to Coask. The system now supports:

✅ Flexible job scheduling (one-time and recurring)
✅ Calendar and event management
✅ Automated workflow execution
✅ Queue monitoring and control
✅ Cron-based scheduling
✅ Job retry and error handling

**Progress**: 4/6 phases complete (67%)
**Lines Added**: 1,927
**APIs Added**: 17 new endpoints
**Agents Added**: Calendar Agent

Phase 4 sets the foundation for fully automated AI workflows, enabling Coask to execute complex, time-based tasks without manual intervention.
