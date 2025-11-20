# Phase 5 Quick Start Guide

Get up and running with Webhooks, Tracing, and Cost Tracking in 5 minutes.

---

## Prerequisites

- Coask server running on `http://localhost:3000`
- curl or similar HTTP client
- (Optional) GitHub account for webhook testing
- (Optional) Slack workspace for webhook testing

---

## 1. Test Webhooks (2 minutes)

### Register a Custom Webhook

```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Webhook",
    "source": "custom",
    "url": "/webhooks/custom/research",
    "enabled": true,
    "events": ["research"]
  }'
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "id": "webhook-abc123",
    "name": "My First Webhook",
    "enabled": true
  }
}
```

### Trigger the Webhook

```bash
curl -X POST http://localhost:3000/webhooks/custom/research \
  -H "Content-Type: application/json" \
  -d '{
    "event": "research",
    "data": {
      "userId": "quickstart-user",
      "query": "What is the latest in AI?"
    }
  }'
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Research job queued from custom webhook",
  "jobId": "job-xyz789"
}
```

✅ **Success!** Your webhook is now receiving events and triggering research jobs.

### View Your Webhook

```bash
curl http://localhost:3000/webhooks
```

---

## 2. Monitor Execution Traces (1 minute)

### View Active Traces

```bash
curl http://localhost:3000/tracing/active
```

If you just triggered the webhook above, you should see a trace for the research job.

### View All Traces

```bash
curl http://localhost:3000/tracing?limit=10
```

### View Trace Statistics

```bash
curl http://localhost:3000/tracing/stats
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "totalTraces": 5,
    "runningTraces": 1,
    "successTraces": 4,
    "errorTraces": 0,
    "averageDuration": 2500
  }
}
```

✅ **Success!** You can now see all workflow executions in real-time.

---

## 3. Track Costs (1 minute)

### Set Up a Daily Budget

```bash
curl -X POST http://localhost:3000/costs/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Test Budget",
    "limit": 10.00,
    "period": "daily",
    "alertThreshold": 80,
    "enabled": true
  }'
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "id": "budget-abc123",
    "name": "Daily Test Budget",
    "limit": 10.00,
    "currentSpend": 0
  }
}
```

### View Cost Summary

```bash
curl http://localhost:3000/costs/summary
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "totalCost": 0.15,
    "totalTokens": 5000,
    "totalCalls": 3,
    "byProvider": {
      "openai": {
        "cost": 0.15,
        "tokens": 5000,
        "calls": 3
      }
    }
  }
}
```

### Check Budget Alerts

```bash
curl http://localhost:3000/costs/alerts
```

✅ **Success!** You're now tracking LLM costs and have budget alerts set up.

---

## 4. Complete Example: GitHub Webhook (1 minute)

### Register GitHub Webhook

```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GitHub Auto-Analyzer",
    "source": "github",
    "url": "/webhooks/github/issues",
    "secret": "your-github-secret-here",
    "enabled": true,
    "events": ["opened", "reopened"]
  }'
```

### Configure in GitHub

1. Go to your repository → **Settings** → **Webhooks**
2. Click **Add webhook**
3. Set **Payload URL**: `https://your-coask-domain.com/webhooks/github/issues`
4. Set **Content type**: `application/json`
5. Set **Secret**: `your-github-secret-here`
6. Select **Let me select individual events** → Check **Issues**
7. Click **Add webhook**

### Test It

1. Create a new issue in your GitHub repository
2. Check if webhook was triggered:

```bash
curl http://localhost:3000/webhooks/stats
```

3. View the trace:

```bash
curl http://localhost:3000/tracing?userId=github_webhook
```

✅ **Success!** GitHub issues now automatically trigger analysis workflows.

---

## 5. Dashboard View (Bonus)

### Get All System Stats at Once

```bash
#!/bin/bash

echo "=== WEBHOOK STATS ==="
curl -s http://localhost:3000/webhooks/stats | jq .

echo "\n=== TRACING STATS ==="
curl -s http://localhost:3000/tracing/stats | jq .

echo "\n=== COST SUMMARY ==="
curl -s http://localhost:3000/costs/summary | jq .

echo "\n=== ACTIVE TRACES ==="
curl -s http://localhost:3000/tracing/active | jq '.data | length'

echo "\n=== COST ALERTS ==="
curl -s http://localhost:3000/costs/alerts | jq '.data | length'
```

Save as `dashboard.sh`, make executable, and run:

```bash
chmod +x dashboard.sh
./dashboard.sh
```

---

## Common Use Cases

### Use Case 1: Auto-Research on New GitHub Issues

**Setup:**
```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Issue Researcher",
    "source": "github",
    "url": "/webhooks/github/auto-research",
    "secret": "github-secret",
    "enabled": true,
    "events": ["opened"]
  }'
```

**What happens:**
1. User creates GitHub issue
2. Webhook triggers → Research job queued
3. Research agent analyzes issue
4. Results saved to knowledge base
5. View trace and cost in dashboard

### Use Case 2: Slack Research Bot

**Setup:**
```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Research Bot",
    "source": "slack",
    "url": "/webhooks/slack/bot",
    "secret": "slack-signing-secret",
    "enabled": true,
    "events": ["message", "app_mention"]
  }'
```

**Usage in Slack:**
```
@CoaskBot research quantum computing applications
```

**What happens:**
1. User mentions bot in Slack
2. Webhook receives message
3. Detects "research" trigger word
4. Queues research job
5. Results can be posted back to Slack

### Use Case 3: Cost-Aware Operations

**Setup:**
```typescript
import { costTracker } from './cost-tracking';

async function safeLLMCall(userId: string) {
  // Check if budget exceeded
  const alerts = await fetch('http://localhost:3000/costs/alerts').then(r => r.json());
  const budgetExceeded = alerts.data.some(a => a.type === 'limit');

  if (budgetExceeded) {
    console.log('Budget exceeded, using cache instead');
    return getCachedResponse();
  }

  // Make LLM call
  const response = await callLLM();

  // Track cost
  costTracker.trackCost({
    userId,
    provider: 'openai',
    model: 'gpt-4o',
    operation: 'chat',
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens
  });

  return response;
}
```

---

## Troubleshooting

### Webhook Not Triggering

**Check 1:** Is webhook enabled?
```bash
curl http://localhost:3000/webhooks
```

**Check 2:** Are events correct?
```bash
curl http://localhost:3000/webhooks/:webhook-id
```

**Fix:** Update webhook
```bash
curl -X PUT http://localhost:3000/webhooks/:webhook-id \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "events": ["opened", "closed"]}'
```

### No Traces Showing

**Check:** Is tracing initialized?
```bash
curl http://localhost:3000/tracing/stats
```

If empty, traces are working but no workflows have been executed yet.

### Costs Not Tracked

**Check:** Are LLM calls being made?
```bash
curl http://localhost:3000/costs/summary
```

**Note:** Costs only appear after LLM API calls. In development without API keys, costs won't be tracked.

---

## Next Steps

1. **Read Full Documentation**: [phase-5-user-guide.md](./phase-5-user-guide.md)
2. **API Examples**: [phase-5-api-examples.md](./phase-5-api-examples.md)
3. **Set Production Budgets**: Create budgets for production workloads
4. **Export Data**: Regularly export traces and costs for analysis
5. **Add More Webhooks**: Integrate with Slack, Discord, custom apps

---

## Quick Reference

### Webhook Endpoints
- `POST /webhooks/register` - Register webhook
- `GET /webhooks` - List webhooks
- `POST /webhooks/:source/:path` - Receive webhook event
- `DELETE /webhooks/:id` - Delete webhook

### Tracing Endpoints
- `GET /tracing` - Query traces
- `GET /tracing/active` - Active traces
- `GET /tracing/stats` - Statistics
- `GET /tracing/export` - Export traces

### Cost Endpoints
- `GET /costs/summary` - Cost summary
- `GET /costs` - Cost entries
- `POST /costs/budgets` - Create budget
- `GET /costs/alerts` - Budget alerts

---

## Support

- Documentation: See `docs/` folder
- Issues: Create GitHub issue
- Examples: See [phase-5-api-examples.md](./phase-5-api-examples.md)

**Congratulations! You've successfully set up webhooks, tracing, and cost tracking.** 🎉
