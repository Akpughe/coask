# Phase 5 API Examples

Quick reference with copy-paste examples for all Phase 5 features.

---

## Webhooks API Examples

### Register GitHub Webhook

```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GitHub Issue Tracker",
    "source": "github",
    "url": "/webhooks/github/issues",
    "secret": "your-github-webhook-secret",
    "enabled": true,
    "events": ["opened", "reopened", "created"]
  }'
```

### Register Slack Webhook

```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Bot",
    "source": "slack",
    "url": "/webhooks/slack/bot",
    "secret": "your-slack-signing-secret",
    "enabled": true,
    "events": ["message", "app_mention"]
  }'
```

### Register Custom Webhook

```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom App Webhook",
    "source": "custom",
    "url": "/webhooks/custom/events",
    "secret": "my-custom-secret-key",
    "enabled": true,
    "events": ["research", "email"]
  }'
```

### List All Webhooks

```bash
curl http://localhost:3000/webhooks
```

### Get Webhook by ID

```bash
curl http://localhost:3000/webhooks/webhook-uuid-here
```

### Update Webhook

```bash
curl -X PUT http://localhost:3000/webhooks/webhook-uuid-here \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'
```

### Delete Webhook

```bash
curl -X DELETE http://localhost:3000/webhooks/webhook-uuid-here
```

### Get Webhook Statistics

```bash
curl http://localhost:3000/webhooks/stats
```

### Send Custom Webhook Event

```bash
# Without signature (if no secret configured)
curl -X POST http://localhost:3000/webhooks/custom/research \
  -H "Content-Type: application/json" \
  -d '{
    "event": "research",
    "data": {
      "userId": "user-123",
      "query": "Latest developments in renewable energy",
      "saveToKnowledgeBase": true,
      "webSearch": true
    }
  }'

# With signature (if secret configured)
# First compute HMAC-SHA256 signature
# Then include in X-Webhook-Signature header
curl -X POST http://localhost:3000/webhooks/custom/research \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: computed-hmac-sha256-here" \
  -d '{
    "event": "research",
    "data": {
      "userId": "user-123",
      "query": "Latest developments in renewable energy"
    }
  }'
```

---

## Tracing API Examples

### Query Traces

```bash
# Get all traces
curl http://localhost:3000/tracing

# Filter by user
curl "http://localhost:3000/tracing?userId=user-123"

# Filter by status
curl "http://localhost:3000/tracing?status=success"

# Filter by date range
curl "http://localhost:3000/tracing?startTimeFrom=2025-11-01T00:00:00Z&startTimeTo=2025-11-30T23:59:59Z"

# Pagination
curl "http://localhost:3000/tracing?limit=50&offset=100"

# Combined filters
curl "http://localhost:3000/tracing?userId=user-123&status=success&limit=20"
```

### Get Active Traces

```bash
curl http://localhost:3000/tracing/active
```

### Get Trace by ID

```bash
curl http://localhost:3000/tracing/trace-uuid-here
```

### Get Trace Statistics

```bash
curl http://localhost:3000/tracing/stats
```

**Example Response:**
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
      "rag_query": 300
    },
    "byStatus": {
      "running": 5,
      "success": 950,
      "error": 45
    }
  }
}
```

### Export Traces

```bash
# Export all traces
curl http://localhost:3000/tracing/export -o traces-export.json

# Export filtered traces
curl "http://localhost:3000/tracing/export?userId=user-123&startTimeFrom=2025-11-01T00:00:00Z" \
  -o traces-november.json
```

### Delete Trace

```bash
curl -X DELETE http://localhost:3000/tracing/trace-uuid-here
```

### Clear All Traces

```bash
# ⚠️ Warning: This deletes ALL traces
curl -X DELETE http://localhost:3000/tracing
```

---

## Cost Tracking API Examples

### Get Cost Summary

```bash
# Current month summary
curl "http://localhost:3000/costs/summary?startDate=2025-11-01&endDate=2025-11-30"

# User-specific summary
curl "http://localhost:3000/costs/summary?userId=user-123"

# Provider-specific summary
curl "http://localhost:3000/costs/summary?provider=openai&startDate=2025-11-01"

# Trace-specific costs
curl "http://localhost:3000/costs/summary?traceId=trace-uuid-here"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
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
      }
    }
  }
}
```

### Query Cost Entries

```bash
# Get recent costs
curl "http://localhost:3000/costs?limit=100"

# Filter by user
curl "http://localhost:3000/costs?userId=user-123"

# Filter by provider
curl "http://localhost:3000/costs?provider=openai"

# Filter by model
curl "http://localhost:3000/costs?model=gpt-4o"

# Date range
curl "http://localhost:3000/costs?startDate=2025-11-01&endDate=2025-11-30"

# Combined filters
curl "http://localhost:3000/costs?userId=user-123&provider=openai&limit=50"
```

### Export Costs

```bash
# Export all costs
curl http://localhost:3000/costs/export -o costs-export.json

# Export filtered costs
curl "http://localhost:3000/costs/export?userId=user-123&startDate=2025-11-01" \
  -o costs-user-123-november.json
```

### Create Budget

```bash
# Daily budget
curl -X POST http://localhost:3000/costs/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily OpenAI Budget",
    "limit": 50.00,
    "period": "daily",
    "alertThreshold": 80,
    "enabled": true
  }'

# Weekly budget
curl -X POST http://localhost:3000/costs/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekly Team Budget",
    "limit": 300.00,
    "period": "weekly",
    "alertThreshold": 75,
    "enabled": true
  }'

# User-specific budget
curl -X POST http://localhost:3000/costs/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "name": "User 123 Monthly Budget",
    "limit": 100.00,
    "period": "monthly",
    "alertThreshold": 90,
    "enabled": true
  }'
```

**Example Response:**
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

### List Budgets

```bash
curl http://localhost:3000/costs/budgets
```

### Get Cost Alerts

```bash
# Get recent alerts
curl http://localhost:3000/costs/alerts

# Limit results
curl "http://localhost:3000/costs/alerts?limit=20"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-uuid",
      "budgetId": "budget-uuid",
      "timestamp": "2025-11-20T15:30:00.000Z",
      "type": "threshold",
      "currentSpend": 40.00,
      "limit": 50.00,
      "percentage": 80.0,
      "message": "Budget 'Daily OpenAI Budget' has reached 80.0% of limit"
    },
    {
      "id": "alert-uuid-2",
      "budgetId": "budget-uuid",
      "timestamp": "2025-11-20T18:45:00.000Z",
      "type": "limit",
      "currentSpend": 52.00,
      "limit": 50.00,
      "percentage": 104.0,
      "message": "Budget 'Daily OpenAI Budget' has exceeded the limit!"
    }
  ],
  "count": 2
}
```

---

## Code Examples

### TypeScript/JavaScript

#### Compute Webhook Signature

```typescript
import crypto from 'crypto';

function computeWebhookSignature(payload: any, secret: string): string {
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
  return signature;
}

// Usage
const payload = {
  event: "research",
  data: {
    userId: "user-123",
    query: "Latest AI trends"
  }
};

const secret = "my-webhook-secret";
const signature = computeWebhookSignature(payload, secret);

// Send webhook
fetch('http://localhost:3000/webhooks/custom/research', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature
  },
  body: JSON.stringify(payload)
});
```

#### Trace a Workflow

```typescript
import { traceWorkflow, traceLLMCall } from './tracing';
import { costTracker } from './cost-tracking';

async function myWorkflow(userId: string) {
  return traceWorkflow(
    userId,
    'My Research Workflow',
    undefined,
    async (trace) => {
      console.log(`Workflow trace ID: ${trace.id}`);

      // Perform LLM call with tracing
      const result = await traceLLMCall(
        trace.id,
        'openai',
        'gpt-4o',
        async (span) => {
          // Make actual LLM call
          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'Hello' }]
          });

          // Track cost
          costTracker.trackCost({
            userId,
            provider: 'openai',
            model: 'gpt-4o',
            operation: 'chat',
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            traceId: trace.id,
            spanId: span.id
          });

          return response;
        }
      );

      return result;
    }
  );
}

// Execute
const result = await myWorkflow('user-123');
```

#### Track Cost Manually

```typescript
import { costTracker } from './cost-tracking';

async function callLLMWithCostTracking(userId: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Analyze this data...' }]
  });

  // Track the cost
  const costEntry = costTracker.trackCost({
    userId,
    provider: 'openai',
    model: 'gpt-4o',
    operation: 'analysis',
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    metadata: {
      taskType: 'data-analysis'
    }
  });

  console.log(`Cost: $${costEntry.totalCost.toFixed(4)}`);
  console.log(`Tokens: ${costEntry.totalTokens}`);

  return response;
}
```

### Python

#### Compute Webhook Signature

```python
import hmac
import hashlib
import json
import requests

def compute_webhook_signature(payload: dict, secret: str) -> str:
    payload_string = json.dumps(payload, separators=(',', ':'))
    signature = hmac.new(
        secret.encode(),
        payload_string.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature

# Usage
payload = {
    "event": "research",
    "data": {
        "userId": "user-123",
        "query": "Latest AI trends"
    }
}

secret = "my-webhook-secret"
signature = compute_webhook_signature(payload, secret)

# Send webhook
response = requests.post(
    'http://localhost:3000/webhooks/custom/research',
    json=payload,
    headers={
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature
    }
)

print(response.json())
```

#### Query Traces

```python
import requests
from datetime import datetime, timedelta

# Get traces from last 7 days
end_date = datetime.now()
start_date = end_date - timedelta(days=7)

response = requests.get(
    'http://localhost:3000/tracing',
    params={
        'userId': 'user-123',
        'status': 'success',
        'startTimeFrom': start_date.isoformat() + 'Z',
        'startTimeTo': end_date.isoformat() + 'Z',
        'limit': 100
    }
)

traces = response.json()['data']
print(f"Found {len(traces)} traces")

for trace in traces:
    print(f"- {trace['name']}: {trace['duration']}ms")
```

#### Get Cost Summary

```python
import requests
from datetime import datetime

# Get cost summary for current month
response = requests.get(
    'http://localhost:3000/costs/summary',
    params={
        'userId': 'user-123',
        'startDate': '2025-11-01T00:00:00Z',
        'endDate': '2025-11-30T23:59:59Z'
    }
)

summary = response.json()['data']

print(f"Total Cost: ${summary['totalCost']:.2f}")
print(f"Total Tokens: {summary['totalTokens']:,}")
print(f"Total Calls: {summary['totalCalls']}")

print("\nBy Provider:")
for provider, stats in summary['byProvider'].items():
    print(f"  {provider}: ${stats['cost']:.2f} ({stats['tokens']:,} tokens)")

print("\nBy Model:")
for model, stats in summary['byModel'].items():
    print(f"  {model}: ${stats['cost']:.2f} ({stats['calls']} calls)")
```

---

## Testing Examples

### Test GitHub Webhook Locally

```bash
# 1. Register webhook
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test GitHub",
    "source": "github",
    "url": "/webhooks/github/test",
    "secret": "test-secret",
    "enabled": true,
    "events": ["opened"]
  }'

# 2. Simulate GitHub issue event
curl -X POST http://localhost:3000/webhooks/github/test \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(echo -n '{"action":"opened","issue":{"number":123,"title":"Test Issue","body":"This is a test"}}' | openssl dgst -sha256 -hmac 'test-secret' | awk '{print $2}')" \
  -d '{
    "action": "opened",
    "issue": {
      "number": 123,
      "title": "Test Issue",
      "body": "This is a test"
    },
    "repository": {
      "full_name": "test/repo"
    }
  }'
```

### Test Slack Webhook Locally

```bash
# 1. Register webhook
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Slack",
    "source": "slack",
    "url": "/webhooks/slack/test",
    "secret": "test-secret",
    "enabled": true,
    "events": ["message"]
  }'

# 2. Simulate Slack message
TIMESTAMP=$(date +%s)
PAYLOAD='{"type":"event_callback","event":{"type":"message","user":"U123","text":"research AI trends","channel":"C123"}}'
SIGNATURE="v0=$(echo -n "v0:${TIMESTAMP}:${PAYLOAD}" | openssl dgst -sha256 -hmac 'test-secret' | awk '{print $2}')"

curl -X POST http://localhost:3000/webhooks/slack/test \
  -H "Content-Type: application/json" \
  -H "X-Slack-Request-Timestamp: $TIMESTAMP" \
  -H "X-Slack-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### Test Custom Webhook

```bash
# 1. Register webhook (no secret for testing)
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Custom",
    "source": "custom",
    "url": "/webhooks/custom/test",
    "enabled": true,
    "events": ["research"]
  }'

# 2. Send test event
curl -X POST http://localhost:3000/webhooks/custom/test \
  -H "Content-Type: application/json" \
  -d '{
    "event": "research",
    "data": {
      "userId": "test-user",
      "query": "What is quantum computing?",
      "saveToKnowledgeBase": true
    }
  }'
```

---

## Dashboard Query Examples

### Get Real-Time System Stats

```bash
# Get all stats in parallel
curl http://localhost:3000/webhooks/stats > webhooks-stats.json &
curl http://localhost:3000/tracing/stats > tracing-stats.json &
curl http://localhost:3000/costs/summary > costs-summary.json &
wait

# Display
cat webhooks-stats.json | jq .
cat tracing-stats.json | jq .
cat costs-summary.json | jq .
```

### Monitor Active Operations

```bash
# Check every 5 seconds
watch -n 5 'curl -s http://localhost:3000/tracing/active | jq ".data | length"'
```

### Check Budget Status

```bash
# Get all budgets with current spend
curl -s http://localhost:3000/costs/budgets | jq '.data[] | {
  name: .name,
  limit: .limit,
  current: .currentSpend,
  percentage: ((.currentSpend / .limit) * 100)
}'
```

### Daily Cost Report

```bash
#!/bin/bash
TODAY=$(date +%Y-%m-%d)
START="${TODAY}T00:00:00Z"
END="${TODAY}T23:59:59Z"

curl -s "http://localhost:3000/costs/summary?startDate=$START&endDate=$END" | \
  jq '{
    date: "'$TODAY'",
    totalCost: .data.totalCost,
    totalCalls: .data.totalCalls,
    providers: .data.byProvider
  }'
```

---

## Error Handling Examples

### Handle Webhook Errors

```typescript
async function sendWebhook(url: string, payload: any, secret?: string) {
  const headers: any = {
    'Content-Type': 'application/json'
  };

  if (secret) {
    const signature = computeWebhookSignature(payload, secret);
    headers['X-Webhook-Signature'] = signature;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Webhook failed:', error);
      return { success: false, error };
    }

    return await response.json();
  } catch (error) {
    console.error('Network error:', error);
    return { success: false, error: 'Network error' };
  }
}
```

### Handle Budget Alerts

```typescript
async function checkBudget(userId: string): Promise<boolean> {
  const response = await fetch('http://localhost:3000/costs/alerts?limit=10');
  const data = await response.json();

  const recentAlerts = data.data.filter((alert: any) => {
    const alertTime = new Date(alert.timestamp);
    const oneHourAgo = new Date(Date.now() - 3600000);
    return alertTime > oneHourAgo && alert.type === 'limit';
  });

  if (recentAlerts.length > 0) {
    console.warn('Budget limit exceeded! Pausing expensive operations.');
    return false;
  }

  return true;
}

// Use before expensive operations
if (await checkBudget(userId)) {
  await expensiveLLMCall();
} else {
  console.log('Budget exceeded, skipping operation');
}
```

---

## Performance Tips

### Batch Cost Tracking

```typescript
// Don't track every single call immediately
const costBuffer: any[] = [];

function bufferCost(entry: any) {
  costBuffer.push(entry);

  // Flush every 100 entries or every minute
  if (costBuffer.length >= 100) {
    flushCosts();
  }
}

function flushCosts() {
  costBuffer.forEach(entry => costTracker.trackCost(entry));
  costBuffer.length = 0;
}

setInterval(flushCosts, 60000); // Flush every minute
```

### Query with Pagination

```typescript
async function getAllTraces(userId: string) {
  const allTraces = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `http://localhost:3000/tracing?userId=${userId}&limit=${limit}&offset=${offset}`
    );
    const data = await response.json();

    allTraces.push(...data.data);

    if (data.count < limit) break;
    offset += limit;
  }

  return allTraces;
}
```

---

## Integration Patterns

### Webhook → Job → Trace → Cost Flow

```typescript
// 1. Webhook handler
app.post('/webhooks/custom/analysis', async (req, res) => {
  // Create trace
  const trace = traceManager.startTrace({
    userId: req.body.data.userId,
    name: 'Analysis Workflow'
  });

  // Queue job with trace ID
  await jobQueue.addJob(
    JobType.RESEARCH_TASK,
    req.body.data.userId,
    {
      query: req.body.data.query,
      traceId: trace.id
    }
  );

  res.json({ success: true, traceId: trace.id });
});

// 2. Job processor
async function processAnalysisJob(job: Job) {
  const { query, traceId } = job.data.payload;

  // Add span to trace
  const span = traceManager.startSpan(traceId, {
    name: 'LLM Analysis',
    type: 'llm_call'
  });

  // Make LLM call
  const response = await callLLM(query);

  // Track cost
  costTracker.trackCost({
    userId: job.data.userId,
    provider: 'openai',
    model: 'gpt-4o',
    operation: 'analysis',
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    traceId,
    spanId: span.id
  });

  // End span
  traceManager.endSpan(traceId, span.id, 'success');

  return response;
}
```

---

For more examples and detailed documentation, see [phase-5-user-guide.md](./phase-5-user-guide.md).
