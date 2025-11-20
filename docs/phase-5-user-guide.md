# Phase 5: External Integrations & Observability

**Status**: ✅ Complete
**Version**: 1.0.0
**Last Updated**: 2025-11-20

This document covers the three major systems implemented in Phase 5:
1. **Webhook System** - External event triggers
2. **Execution Tracing** - Workflow observability
3. **Cost Tracking** - LLM usage and budget management

---

## Table of Contents

- [Webhook System](#webhook-system)
  - [Overview](#webhook-overview)
  - [Setup](#webhook-setup)
  - [GitHub Webhooks](#github-webhooks)
  - [Slack Webhooks](#slack-webhooks)
  - [Custom Webhooks](#custom-webhooks)
  - [API Reference](#webhook-api-reference)
- [Execution Tracing](#execution-tracing)
  - [Overview](#tracing-overview)
  - [Usage](#tracing-usage)
  - [API Reference](#tracing-api-reference)
- [Cost Tracking](#cost-tracking)
  - [Overview](#cost-overview)
  - [Setup](#cost-setup)
  - [Budgets](#budgets)
  - [API Reference](#cost-api-reference)

---

## Webhook System

### Webhook Overview

The webhook system allows Coask to receive and process events from external services like GitHub, Slack, or custom applications. When an event occurs (e.g., a new GitHub issue), the webhook triggers automatic workflows or queues jobs.

**Key Features:**
- 🔐 Cryptographic signature verification (HMAC SHA-256)
- 🎯 Flexible routing based on event types
- 🔄 Automatic workflow triggering
- 📊 Event logging and tracking
- 🛠️ Support for GitHub, Slack, and custom webhooks

### Webhook Setup

#### 1. Register a Webhook

```bash
POST /webhooks/register
Content-Type: application/json

{
  "name": "GitHub Issues",
  "source": "github",
  "url": "/webhooks/github/issues",
  "secret": "your-webhook-secret",
  "enabled": true,
  "events": ["opened", "reopened", "created"],
  "triggerWorkflow": "issue-analysis-workflow",
  "metadata": {
    "repo": "myorg/myrepo"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "webhook-uuid-here",
    "name": "GitHub Issues",
    "source": "github",
    "url": "/webhooks/github/issues",
    "enabled": true,
    "events": ["opened", "reopened", "created"],
    "createdAt": "2025-11-20T12:00:00.000Z",
    "updatedAt": "2025-11-20T12:00:00.000Z"
  }
}
```

#### 2. Configure External Service

In your external service (GitHub, Slack, etc.), configure the webhook URL:

```
https://your-coask-instance.com/webhooks/github/issues
```

Add the secret you used when registering the webhook.

### GitHub Webhooks

#### Supported Events

- **Issues**: `opened`, `reopened`, `closed`
- **Pull Requests**: `opened`, `reopened`, `synchronize`, `closed`
- **Comments**: `created`
- **Push**: `push`

#### Example: Auto-Analyze New Issues

**1. Register the webhook:**
```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Auto-Analyze Issues",
    "source": "github",
    "url": "/webhooks/github/auto-analyze",
    "secret": "ghp_your_webhook_secret_here",
    "enabled": true,
    "events": ["opened", "reopened"]
  }'
```

**2. Configure in GitHub:**

Go to your repository → Settings → Webhooks → Add webhook

- **Payload URL**: `https://your-coask.com/webhooks/github/auto-analyze`
- **Content type**: `application/json`
- **Secret**: `ghp_your_webhook_secret_here`
- **Events**: Let me select individual events → Issues

**3. Behavior:**

When a new issue is opened, Coask will:
- Verify the webhook signature
- Extract issue title and body
- Queue a research job to analyze the issue
- Save results to knowledge base

#### Example: Trigger Workflow on PR

```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PR Review Assistant",
    "source": "github",
    "url": "/webhooks/github/pr-review",
    "secret": "ghp_webhook_secret",
    "enabled": true,
    "events": ["opened", "synchronize"],
    "triggerWorkflow": "pr-review-workflow"
  }'
```

When a PR is opened or updated:
- Coask triggers the `pr-review-workflow`
- Workflow receives PR data as context
- Can perform automated code review, testing, etc.

### Slack Webhooks

#### Supported Events

- **Messages**: `message`
- **App Mentions**: `app_mention`
- **URL Verification**: `url_verification`

#### Example: Slack Bot Integration

**1. Register the webhook:**
```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Research Bot",
    "source": "slack",
    "url": "/webhooks/slack/bot",
    "secret": "your-slack-signing-secret",
    "enabled": true,
    "events": ["message", "app_mention"]
  }'
```

**2. Configure in Slack:**

Go to Slack App → Event Subscriptions → Enable Events

- **Request URL**: `https://your-coask.com/webhooks/slack/bot`
- **Subscribe to bot events**: `message.channels`, `app_mention`

**3. Usage:**

In any Slack channel where the bot is present:

```
@CoaskBot research latest AI developments
```

Coask will:
- Detect the trigger word "research"
- Extract the query "latest AI developments"
- Queue a research job
- Results can be posted back to Slack (if configured)

#### Trigger Patterns

The Slack handler recognizes these patterns:
- `research <query>` - Performs web research
- `analyze <query>` - Analyzes information
- `search <query>` - Searches knowledge base
- `find <query>` - Finds information

### Custom Webhooks

For integrations beyond GitHub and Slack, use custom webhooks with flexible routing.

#### Event Types

- **Research**: `research`, `search`
- **Email**: `email`, `send_email`
- **Calendar**: `calendar`, `schedule`

#### Example: Custom Research Webhook

```bash
# 1. Register webhook
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "External App Research",
    "source": "custom",
    "url": "/webhooks/custom/research",
    "secret": "my-custom-secret",
    "enabled": true,
    "events": ["research"]
  }'

# 2. Send event from your app
curl -X POST http://localhost:3000/webhooks/custom/research \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: <computed-hmac-sha256>" \
  -d '{
    "event": "research",
    "data": {
      "userId": "user-123",
      "query": "What are the latest trends in quantum computing?",
      "saveToKnowledgeBase": true,
      "category": "quantum-research",
      "webSearch": true
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Research job queued from custom webhook",
  "jobId": "job-uuid-here"
}
```

#### Example: Custom Email Webhook

```bash
curl -X POST http://localhost:3000/webhooks/custom/email \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: <computed-hmac-sha256>" \
  -d '{
    "event": "email",
    "data": {
      "userId": "user-123",
      "to": "recipient@example.com",
      "subject": "Meeting Follow-up",
      "context": "Draft an email thanking the team for the productive meeting and outlining next steps.",
      "tone": "professional",
      "autoSend": false
    }
  }'
```

#### Computing Webhook Signature

For custom webhooks with secrets, compute the signature:

```javascript
// JavaScript/Node.js
const crypto = require('crypto');

const payload = JSON.stringify({
  event: "research",
  data: { /* your data */ }
});

const secret = "my-custom-secret";
const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

// Send in header: X-Webhook-Signature: <signature>
```

```python
# Python
import hmac
import hashlib
import json

payload = json.dumps({
    "event": "research",
    "data": { # your data }
})

secret = "my-custom-secret"
signature = hmac.new(
    secret.encode(),
    payload.encode(),
    hashlib.sha256
).hexdigest()

# Send in header: X-Webhook-Signature: <signature>
```

### Webhook API Reference

#### List All Webhooks

```bash
GET /webhooks
```

**Query Parameters:**
- `source` (optional): Filter by source (github, slack, custom)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "webhook-id",
      "name": "GitHub Issues",
      "source": "github",
      "url": "/webhooks/github/issues",
      "enabled": true,
      "events": ["opened", "reopened"],
      "createdAt": "2025-11-20T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

#### Get Webhook by ID

```bash
GET /webhooks/:id
```

#### Update Webhook

```bash
PUT /webhooks/:id
Content-Type: application/json

{
  "enabled": false,
  "events": ["opened", "closed"]
}
```

#### Delete Webhook

```bash
DELETE /webhooks/:id
```

#### Webhook Statistics

```bash
GET /webhooks/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalWebhooks": 5,
    "enabledWebhooks": 4,
    "bySource": {
      "github": 2,
      "slack": 1,
      "custom": 2
    },
    "registeredHandlers": ["github", "slack", "custom"]
  }
}
```

---

## Execution Tracing

### Tracing Overview

Execution tracing provides complete observability into workflow execution, allowing you to track:
- Workflow execution duration
- Agent operations
- LLM API calls
- RAG queries
- Error traces

**Key Features:**
- 📊 Hierarchical span tracking
- ⏱️ Precise timing measurements
- 🔍 Query and filter capabilities
- 📈 Statistics and analytics
- 💾 Export for external analysis

### Tracing Usage

#### Programmatic Tracing

**1. Trace a Workflow:**

```typescript
import { traceWorkflow } from './tracing';

async function executeMyWorkflow(userId: string) {
  return traceWorkflow(
    userId,
    'My Custom Workflow',
    undefined, // workflowId (optional)
    async (trace) => {
      // Your workflow logic here
      console.log('Trace ID:', trace.id);

      // Perform operations
      const result = await performSomeWork();

      return result;
    },
    { // metadata
      source: 'api',
      priority: 'high'
    }
  );
}
```

**2. Trace an LLM Call:**

```typescript
import { traceLLMCall, getCurrentTraceId } from './tracing';

async function callLLM() {
  const traceId = getCurrentTraceId();

  if (traceId) {
    return traceLLMCall(
      traceId,
      'openai',
      'gpt-4o',
      async (span) => {
        // Make LLM call
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }]
        });

        // Add token usage to span
        span.metadata.promptTokens = response.usage.prompt_tokens;
        span.metadata.completionTokens = response.usage.completion_tokens;

        return response;
      },
      {
        temperature: 0.7,
        maxTokens: 1000
      }
    );
  }
}
```

**3. Trace an Agent Execution:**

```typescript
import { traceAgentExecution } from './tracing';

async function executeAgent(traceId: string) {
  return traceAgentExecution(
    traceId,
    'research',
    'web_search',
    async (span) => {
      // Agent logic
      const results = await performResearch();

      // Add metadata
      span.metadata.resultsCount = results.length;
      span.metadata.sources = results.map(r => r.source);

      return results;
    }
  );
}
```

**4. Trace a RAG Query:**

```typescript
import { traceRAGQuery } from './tracing';

async function queryKnowledgeBase(traceId: string, query: string) {
  return traceRAGQuery(
    traceId,
    query,
    async (span) => {
      // RAG query
      const results = await knowledgeBase.query(query);

      // Add metadata
      span.metadata.topK = 5;
      span.metadata.resultsCount = results.length;
      span.metadata.sources = results.map(r => ({
        id: r.id,
        score: r.score
      }));

      return results;
    }
  );
}
```

### Tracing API Reference

#### Query Traces

```bash
GET /tracing?userId=user-123&status=success&limit=50
```

**Query Parameters:**
- `userId`: Filter by user ID
- `workflowId`: Filter by workflow ID
- `status`: Filter by status (running, success, error, cancelled)
- `startTimeFrom`: Start date (ISO 8601)
- `startTimeTo`: End date (ISO 8601)
- `limit`: Max results (default: 100)
- `offset`: Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "trace-uuid",
      "workflowId": "workflow-123",
      "userId": "user-123",
      "name": "Research Workflow",
      "startTime": "2025-11-20T12:00:00.000Z",
      "endTime": "2025-11-20T12:00:05.000Z",
      "duration": 5000,
      "status": "success",
      "spans": [
        {
          "id": "span-uuid-1",
          "traceId": "trace-uuid",
          "name": "LLM Call: openai/gpt-4o",
          "type": "llm_call",
          "startTime": "2025-11-20T12:00:01.000Z",
          "endTime": "2025-11-20T12:00:03.000Z",
          "duration": 2000,
          "status": "success",
          "metadata": {
            "provider": "openai",
            "model": "gpt-4o",
            "promptTokens": 150,
            "completionTokens": 300
          }
        }
      ],
      "metadata": {
        "source": "api"
      },
      "tags": {
        "priority": "high"
      }
    }
  ],
  "count": 1
}
```

#### Get Active Traces

```bash
GET /tracing/active
```

Returns all currently running traces.

#### Get Trace by ID

```bash
GET /tracing/:id
```

#### Get Trace Statistics

```bash
GET /tracing/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTraces": 1000,
    "runningTraces": 5,
    "successTraces": 950,
    "errorTraces": 45,
    "averageDuration": 3500,
    "totalDuration": 3500000,
    "byType": {
      "llm_call": 1500,
      "agent": 500,
      "rag_query": 300,
      "workflow": 1000
    },
    "byStatus": {
      "running": 5,
      "success": 950,
      "error": 45
    }
  }
}
```

#### Export Traces

```bash
GET /tracing/export?userId=user-123&startTimeFrom=2025-11-20T00:00:00Z
```

Downloads traces as JSON file.

#### Delete Trace

```bash
DELETE /tracing/:id
```

#### Clear All Traces

```bash
DELETE /tracing
```

⚠️ **Warning**: This permanently deletes all traces.

---

## Cost Tracking

### Cost Overview

The cost tracking system monitors LLM API usage and helps manage budgets by:
- Tracking token usage per operation
- Calculating costs based on provider pricing
- Setting budgets with automatic alerts
- Providing detailed cost breakdowns

**Pre-loaded Pricing:**
- OpenAI: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo
- Anthropic: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- Google: Gemini 1.5 Pro, Gemini 1.5 Flash

### Cost Setup

#### Programmatic Cost Tracking

```typescript
import { costTracker } from './cost-tracking';

// Track an LLM call cost
async function callLLMWithTracking(userId: string, traceId?: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello' }]
  });

  // Track the cost
  costTracker.trackCost({
    userId,
    provider: 'openai',
    model: 'gpt-4o',
    operation: 'chat',
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    traceId,
    metadata: {
      endpoint: 'chat.completions'
    }
  });

  return response;
}
```

### Budgets

#### Create a Budget

```bash
POST /costs/budgets
Content-Type: application/json

{
  "name": "Daily OpenAI Budget",
  "limit": 50.00,
  "period": "daily",
  "alertThreshold": 80,
  "enabled": true
}
```

**Budget Parameters:**
- `name`: Budget name
- `limit`: Maximum spend (USD)
- `period`: `daily`, `weekly`, or `monthly`
- `alertThreshold`: Alert when % of budget spent (default: 80)
- `userId` (optional): Limit to specific user
- `enabled`: Whether budget is active

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "budget-uuid",
    "name": "Daily OpenAI Budget",
    "limit": 50.00,
    "period": "daily",
    "alertThreshold": 80,
    "enabled": true,
    "currentSpend": 0,
    "periodStart": "2025-11-20T00:00:00.000Z",
    "periodEnd": "2025-11-21T00:00:00.000Z"
  }
}
```

#### Budget Alerts

When spend reaches 80% of budget:
```
⚠️  Budget 'Daily OpenAI Budget' has reached 80.0% of limit
Current: $40.00 / Limit: $50.00
```

When spend exceeds budget:
```
🚨 Budget 'Daily OpenAI Budget' has exceeded the limit!
Current: $52.00 / Limit: $50.00
```

Alerts are available via:
```bash
GET /costs/alerts?limit=50
```

### Cost API Reference

#### Get Cost Summary

```bash
GET /costs/summary?userId=user-123&startDate=2025-11-01&endDate=2025-11-30
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-123",
    "startDate": "2025-11-01T00:00:00.000Z",
    "endDate": "2025-11-30T23:59:59.999Z",
    "totalCost": 125.45,
    "totalTokens": 1500000,
    "totalCalls": 450,
    "currency": "USD",
    "byProvider": {
      "openai": {
        "cost": 85.30,
        "tokens": 1000000,
        "calls": 300
      },
      "anthropic": {
        "cost": 40.15,
        "tokens": 500000,
        "calls": 150
      }
    },
    "byModel": {
      "gpt-4o": {
        "cost": 75.00,
        "tokens": 800000,
        "calls": 250
      },
      "claude-3-5-sonnet": {
        "cost": 40.15,
        "tokens": 500000,
        "calls": 150
      }
    }
  }
}
```

#### Query Cost Entries

```bash
GET /costs?userId=user-123&provider=openai&limit=100
```

**Query Parameters:**
- `userId`: Filter by user
- `provider`: Filter by provider (openai, anthropic, google)
- `model`: Filter by model
- `traceId`: Filter by trace
- `startDate`: Start date (ISO 8601)
- `endDate`: End date (ISO 8601)
- `limit`: Max results
- `offset`: Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cost-entry-uuid",
      "timestamp": "2025-11-20T12:00:00.000Z",
      "userId": "user-123",
      "provider": "openai",
      "model": "gpt-4o",
      "operation": "chat",
      "traceId": "trace-uuid",
      "promptTokens": 150,
      "completionTokens": 300,
      "totalTokens": 450,
      "inputCost": 0.000375,
      "outputCost": 0.003,
      "totalCost": 0.003375,
      "currency": "USD"
    }
  ],
  "count": 1
}
```

#### Export Costs

```bash
GET /costs/export?userId=user-123&startDate=2025-11-01
```

Downloads cost data as JSON file.

#### List Budgets

```bash
GET /costs/budgets
```

#### Get Alerts

```bash
GET /costs/alerts?limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-uuid",
      "budgetId": "budget-uuid",
      "timestamp": "2025-11-20T12:00:00.000Z",
      "type": "threshold",
      "currentSpend": 40.00,
      "limit": 50.00,
      "percentage": 80.0,
      "message": "Budget 'Daily OpenAI Budget' has reached 80.0% of limit"
    }
  ],
  "count": 1
}
```

#### Custom Pricing

If you have custom pricing or use a model not in the default list:

```typescript
import { costTracker } from './cost-tracking';

// Set custom pricing
costTracker.setPricing({
  provider: 'custom-provider',
  model: 'custom-model',
  inputCostPer1kTokens: 0.001,
  outputCostPer1kTokens: 0.002,
  currency: 'USD'
});
```

---

## Integration Examples

### Complete Workflow with All Systems

```typescript
import { traceWorkflow, getCurrentTraceId } from './tracing';
import { costTracker } from './cost-tracking';

async function completeWorkflow(userId: string) {
  // 1. Start tracing
  return traceWorkflow(
    userId,
    'Research and Email Workflow',
    undefined,
    async (trace) => {
      const traceId = trace.id;

      // 2. Perform research with tracing
      const research = await traceAgentExecution(
        traceId,
        'research',
        'web_search',
        async (span) => {
          // Call LLM
          const response = await callLLM('Analyze latest AI trends');

          // 3. Track cost
          costTracker.trackCost({
            userId,
            provider: 'openai',
            model: 'gpt-4o',
            operation: 'research',
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            traceId,
            spanId: span.id
          });

          return response;
        }
      );

      // 4. Generate email
      const email = await generateEmail(traceId, userId, research);

      return { research, email };
    },
    {
      source: 'api',
      workflowType: 'research-email'
    }
  );
}
```

### Webhook → Trace → Cost Flow

```typescript
// Webhook handler automatically creates traces
// Example: GitHub issue webhook

// 1. Webhook received
POST /webhooks/github/issues

// 2. Handler creates trace
const trace = traceManager.startTrace({
  userId: 'github_webhook',
  workflowId: undefined,
  name: 'GitHub Issue Analysis'
});

// 3. Queue job with trace ID
jobQueue.addJob(
  JobType.RESEARCH_TASK,
  'github_webhook',
  { query: issueTitle, traceId: trace.id }
);

// 4. Job processor executes with tracing
const result = await researchAgent.research({
  query: issueTitle,
  traceId: trace.id
});

// 5. LLM calls tracked for cost
costTracker.trackCost({ /* ... */ });

// 6. Query results
GET /tracing?workflowId=<id>
GET /costs/summary?traceId=<trace-id>
```

---

## Best Practices

### Webhooks

1. **Always use secrets** for production webhooks
2. **Verify signatures** before processing events
3. **Use specific event types** to reduce noise
4. **Test with webhook replay** tools before production
5. **Monitor webhook stats** regularly

### Tracing

1. **Trace all workflows** for observability
2. **Add meaningful metadata** to spans
3. **Use hierarchical spans** for nested operations
4. **Export traces** for long-term analysis
5. **Query by workflow** to debug issues

### Cost Tracking

1. **Set budgets** before deploying to production
2. **Alert at 80%** to prevent overages
3. **Track by user** for multi-tenant systems
4. **Export monthly** for accounting
5. **Monitor costs** by model to optimize

---

## Troubleshooting

### Webhook Not Triggering

**Check:**
1. Webhook is enabled: `GET /webhooks/:id`
2. Events match: Verify `events` array includes the event type
3. Signature valid: Check logs for verification errors
4. Handler registered: `GET /webhooks/stats` → check `registeredHandlers`

**Fix:**
```bash
# Update webhook
PUT /webhooks/:id
{ "enabled": true, "events": ["opened", "closed"] }
```

### Trace Not Created

**Check:**
1. `traceManager` initialized: Check startup logs
2. Trace context set: Use `traceWorkflow()` wrapper
3. Trace ID passed: Verify `traceId` parameter

**Fix:**
```typescript
// Always wrap workflows
traceWorkflow(userId, name, workflowId, async (trace) => {
  // Use trace.id for all operations
});
```

### Cost Not Tracked

**Check:**
1. `costTracker` initialized: Check startup logs
2. Token counts correct: Verify `promptTokens` and `completionTokens`
3. Model exists: Check default pricing or add custom

**Fix:**
```typescript
// Add custom pricing
costTracker.setPricing({
  provider: 'openai',
  model: 'gpt-4o',
  inputCostPer1kTokens: 0.0025,
  outputCostPer1kTokens: 0.01,
  currency: 'USD'
});
```

### Budget Alerts Not Firing

**Check:**
1. Budget enabled: `GET /costs/budgets`
2. Period valid: Check `periodStart` and `periodEnd`
3. Threshold set: Verify `alertThreshold` value

**Fix:**
```bash
# Update budget
PUT /costs/budgets/:id
{ "enabled": true, "alertThreshold": 80 }
```

---

## Performance Considerations

### In-Memory Stores

All three systems use in-memory stores by default:
- **Webhooks**: Up to 1,000 webhook configs
- **Traces**: Up to 1,000 traces with auto-cleanup
- **Costs**: Up to 10,000 cost entries with auto-cleanup

For production at scale, implement database persistence.

### Cleanup Policies

- **Traces**: Oldest 20% removed when limit reached
- **Costs**: Oldest 20% removed when limit reached
- **Webhooks**: Manual deletion only

### Query Optimization

- Use `limit` and `offset` for pagination
- Filter by `userId` or `traceId` for faster queries
- Export old data periodically and clear

---

## Security Notes

### Webhook Secrets

- Use strong, random secrets (256+ bits)
- Rotate secrets periodically
- Never commit secrets to version control
- Use environment variables for configuration

### Signature Verification

- Always verify signatures in production
- Use constant-time comparison (built-in)
- Check timestamp to prevent replay attacks (Slack)
- Reject invalid signatures immediately

### API Access

Consider adding authentication to these endpoints in production:
- `POST /webhooks/register` - Protect with API keys
- `DELETE /webhooks/:id` - Require authorization
- `DELETE /tracing` - Require admin access
- `GET /costs/*` - User-specific access control

---

## Next Steps

1. **Test webhooks** with your GitHub/Slack accounts
2. **Monitor traces** for your first workflows
3. **Set budgets** to control LLM costs
4. **Integrate with frontend** for dashboards
5. **Implement persistence** for production scale

For questions or issues, refer to the main documentation or create an issue in the repository.
