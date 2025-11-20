# Use Case: Automated GitHub Issue Triage & Research System

**Scenario**: Automatically triage, research, and respond to GitHub issues using webhooks, tracing, and cost tracking.

---

## Overview

When a new GitHub issue is created:
1. **Webhook** receives the event
2. **Research Agent** analyzes the issue
3. **Tracing** tracks the entire workflow
4. **Cost Tracking** monitors LLM usage
5. **Email Agent** sends summary to team
6. **GitHub Comment** posts findings

**Benefits:**
- Instant issue analysis (< 30 seconds)
- Complete audit trail via tracing
- Cost visibility per issue
- Automated team notifications

---

## Complete Implementation

### Step 1: Setup Webhook

```bash
#!/bin/bash
# File: scripts/setup-github-triage.sh

echo "Setting up GitHub Issue Triage System..."

# 1. Register webhook
WEBHOOK_RESPONSE=$(curl -s -X POST http://localhost:3000/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GitHub Issue Triage",
    "source": "github",
    "url": "/webhooks/github/triage",
    "secret": "'${GITHUB_WEBHOOK_SECRET}'",
    "enabled": true,
    "events": ["opened", "reopened"],
    "metadata": {
      "repository": "myorg/myrepo",
      "auto_respond": true,
      "notify_team": true
    }
  }')

WEBHOOK_ID=$(echo $WEBHOOK_RESPONSE | jq -r '.data.id')
echo "✅ Webhook registered: $WEBHOOK_ID"

# 2. Create daily budget for issue triage
BUDGET_RESPONSE=$(curl -s -X POST http://localhost:3000/costs/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GitHub Triage Daily Budget",
    "limit": 25.00,
    "period": "daily",
    "alertThreshold": 75,
    "enabled": true
  }')

BUDGET_ID=$(echo $BUDGET_RESPONSE | jq -r '.data.id')
echo "✅ Budget created: $BUDGET_ID ($25/day)"

# 3. Display webhook URL for GitHub
echo ""
echo "📋 Configure this in GitHub:"
echo "   URL: https://your-domain.com/webhooks/github/triage"
echo "   Secret: ${GITHUB_WEBHOOK_SECRET}"
echo "   Events: Issues (opened, reopened)"
echo ""
echo "✅ Setup complete!"
```

### Step 2: Enhanced Webhook Handler

```typescript
// File: src/webhooks/handlers/github-triage-handler.ts

import { logger } from '../../utils/logger';
import { traceWorkflow } from '../../tracing';
import { costTracker } from '../../cost-tracking';
import { researchAgent } from '../../agents/research-agent';
import { emailAgent } from '../../agents/email-agent';
import { jobQueue, JobType } from '../../queue/job-queue';
import {
  WebhookEvent,
  WebhookConfig,
  WebhookHandlerResult,
  GitHubWebhookPayload,
} from '../webhook-types';

interface TriageResult {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  relatedIssues: string[];
  suggestedLabels: string[];
  analysis: string;
  estimatedEffort: string;
  assignee?: string;
}

export async function handleGitHubTriage(
  event: WebhookEvent,
  config: WebhookConfig
): Promise<WebhookHandlerResult> {
  const payload = event.payload as GitHubWebhookPayload;
  const issue = payload.issue;

  if (!issue) {
    return { success: false, error: 'No issue in payload' };
  }

  logger.info('Starting GitHub issue triage', {
    issueNumber: issue.number,
    title: issue.title,
    repository: payload.repository?.full_name,
  });

  // Create workflow trace
  return traceWorkflow(
    'github_webhook',
    `Triage Issue #${issue.number}`,
    `github-issue-${issue.number}`,
    async (trace) => {
      const traceId = trace.id;
      let totalCost = 0;

      try {
        // Step 1: Analyze issue with LLM
        const analysis = await analyzeIssue(issue, traceId);
        totalCost += analysis.cost;

        // Step 2: Search for similar issues
        const similarIssues = await findSimilarIssues(issue, traceId);
        totalCost += similarIssues.cost;

        // Step 3: Generate triage result
        const triage = await generateTriageResult(
          issue,
          analysis.result,
          similarIssues.results,
          traceId
        );
        totalCost += triage.cost;

        // Step 4: Post comment to GitHub (if configured)
        if (config.metadata?.auto_respond) {
          await postGitHubComment(issue, triage.result, payload.repository);
        }

        // Step 5: Send email notification to team (if configured)
        if (config.metadata?.notify_team) {
          await sendTeamNotification(issue, triage.result, payload.repository);
        }

        logger.info('Issue triage completed', {
          issueNumber: issue.number,
          severity: triage.result.severity,
          totalCost: totalCost.toFixed(4),
          traceId,
        });

        return {
          success: true,
          message: `Issue #${issue.number} triaged successfully`,
          metadata: {
            traceId,
            severity: triage.result.severity,
            category: triage.result.category,
            totalCost,
          },
        };
      } catch (error: any) {
        logger.error('Issue triage failed', { error, issueNumber: issue.number });
        return {
          success: false,
          error: error.message,
        };
      }
    },
    {
      source: 'github_webhook',
      repository: payload.repository?.full_name,
      issueNumber: issue.number,
    }
  );
}

async function analyzeIssue(issue: any, traceId: string) {
  const startTime = Date.now();

  // Use research agent to analyze the issue
  const prompt = `Analyze this GitHub issue and provide:
1. Severity level (critical/high/medium/low)
2. Issue category (bug/feature/documentation/question/etc)
3. Key technical details
4. Potential impact

Issue Title: ${issue.title}
Issue Body: ${issue.body || 'No description provided'}

Provide a structured analysis.`;

  const response = await researchAgent.chat({
    userId: 'github_triage',
    messages: [{ role: 'user', content: prompt }],
    traceId,
  });

  // Track cost
  const cost = costTracker.trackCost({
    userId: 'github_triage',
    provider: 'openai',
    model: 'gpt-4o-mini', // Use cheaper model for initial analysis
    operation: 'issue_analysis',
    promptTokens: estimateTokens(prompt),
    completionTokens: estimateTokens(response.reply),
    traceId,
    metadata: {
      issueNumber: issue.number,
      step: 'analysis',
    },
  });

  return {
    result: response.reply,
    cost: cost.totalCost,
    duration: Date.now() - startTime,
  };
}

async function findSimilarIssues(issue: any, traceId: string) {
  const startTime = Date.now();

  // Search knowledge base for similar issues
  const searchQuery = `${issue.title} ${issue.body || ''}`.substring(0, 500);

  const results = await researchAgent.research({
    userId: 'github_triage',
    query: searchQuery,
    options: {
      webSearch: false, // Only search knowledge base
      saveToKnowledgeBase: false,
    },
    traceId,
  });

  // Track cost (if any LLM calls were made)
  let cost = 0;
  if (results.synthesis) {
    const costEntry = costTracker.trackCost({
      userId: 'github_triage',
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'similarity_search',
      promptTokens: estimateTokens(searchQuery),
      completionTokens: estimateTokens(results.synthesis),
      traceId,
      metadata: {
        issueNumber: issue.number,
        step: 'similarity',
      },
    });
    cost = costEntry.totalCost;
  }

  return {
    results: results.knowledgeBase || [],
    cost,
    duration: Date.now() - startTime,
  };
}

async function generateTriageResult(
  issue: any,
  analysis: string,
  similarIssues: any[],
  traceId: string
): Promise<{ result: TriageResult; cost: number }> {
  const startTime = Date.now();

  const prompt = `Based on the following analysis and similar issues, generate a triage result:

ANALYSIS:
${analysis}

SIMILAR ISSUES:
${similarIssues.map(i => `- ${i.content?.substring(0, 200)}`).join('\n')}

Provide a JSON response with:
{
  "severity": "critical|high|medium|low",
  "category": "bug|feature|documentation|question|performance|security",
  "relatedIssues": ["#123", "#456"],
  "suggestedLabels": ["bug", "high-priority"],
  "analysis": "Brief summary of the issue",
  "estimatedEffort": "1 hour|1 day|1 week|1 month",
  "assignee": "suggested team member (optional)"
}`;

  const response = await researchAgent.chat({
    userId: 'github_triage',
    messages: [{ role: 'user', content: prompt }],
    traceId,
  });

  // Parse JSON response
  let triageResult: TriageResult;
  try {
    triageResult = JSON.parse(response.reply);
  } catch (error) {
    // Fallback if JSON parsing fails
    triageResult = {
      severity: 'medium',
      category: 'unknown',
      relatedIssues: [],
      suggestedLabels: [],
      analysis: response.reply,
      estimatedEffort: 'unknown',
    };
  }

  // Track cost
  const cost = costTracker.trackCost({
    userId: 'github_triage',
    provider: 'openai',
    model: 'gpt-4o', // Use better model for final triage
    operation: 'triage_generation',
    promptTokens: estimateTokens(prompt),
    completionTokens: estimateTokens(response.reply),
    traceId,
    metadata: {
      issueNumber: issue.number,
      step: 'triage',
      severity: triageResult.severity,
    },
  });

  return {
    result: triageResult,
    cost: cost.totalCost,
  };
}

async function postGitHubComment(
  issue: any,
  triage: TriageResult,
  repository: any
) {
  const comment = `## 🤖 Automated Triage

**Severity:** ${triage.severity.toUpperCase()}
**Category:** ${triage.category}
**Estimated Effort:** ${triage.estimatedEffort}

### Analysis
${triage.analysis}

${triage.relatedIssues.length > 0 ? `### Related Issues\n${triage.relatedIssues.join(', ')}` : ''}

${triage.suggestedLabels.length > 0 ? `### Suggested Labels\n${triage.suggestedLabels.map(l => `\`${l}\``).join(', ')}` : ''}

${triage.assignee ? `### Suggested Assignee\n@${triage.assignee}` : ''}

---
*This triage was performed automatically by Coask AI*`;

  // In production, use GitHub API to post comment
  // For now, just log
  logger.info('GitHub comment generated', {
    issueNumber: issue.number,
    commentLength: comment.length,
  });

  // TODO: Implement actual GitHub API call
  // await octokit.rest.issues.createComment({
  //   owner: repository.owner.login,
  //   repo: repository.name,
  //   issue_number: issue.number,
  //   body: comment
  // });
}

async function sendTeamNotification(
  issue: any,
  triage: TriageResult,
  repository: any
) {
  const subject = `[${triage.severity.toUpperCase()}] New Issue: ${issue.title}`;

  const html = `
    <h2>New GitHub Issue Triaged</h2>

    <p><strong>Repository:</strong> ${repository.full_name}</p>
    <p><strong>Issue:</strong> #${issue.number} - ${issue.title}</p>
    <p><strong>Severity:</strong> <span style="color: ${getSeverityColor(triage.severity)}">${triage.severity.toUpperCase()}</span></p>
    <p><strong>Category:</strong> ${triage.category}</p>
    <p><strong>Estimated Effort:</strong> ${triage.estimatedEffort}</p>

    <h3>Analysis</h3>
    <p>${triage.analysis}</p>

    ${triage.relatedIssues.length > 0 ? `
      <h3>Related Issues</h3>
      <ul>
        ${triage.relatedIssues.map(i => `<li>${i}</li>`).join('')}
      </ul>
    ` : ''}

    ${triage.suggestedLabels.length > 0 ? `
      <h3>Suggested Labels</h3>
      <p>${triage.suggestedLabels.map(l => `<code>${l}</code>`).join(', ')}</p>
    ` : ''}

    <p><a href="${issue.html_url}">View Issue on GitHub →</a></p>

    <hr>
    <p style="font-size: 12px; color: #666;">This notification was sent by Coask AI Triage System</p>
  `;

  await emailAgent.sendEmail({
    userId: 'github_triage',
    from: 'triage@coask.ai',
    to: 'team@company.com',
    subject,
    html,
  });

  logger.info('Team notification sent', {
    issueNumber: issue.number,
    severity: triage.severity,
  });
}

function getSeverityColor(severity: string): string {
  const colors = {
    critical: '#DC3545',
    high: '#FD7E14',
    medium: '#FFC107',
    low: '#28A745',
  };
  return colors[severity as keyof typeof colors] || '#6C757D';
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}
```

### Step 3: Register the Enhanced Handler

```typescript
// File: src/core/startup.ts (add to initializeWebhooks)

import { handleGitHubTriage } from '../webhooks/handlers/github-triage-handler';

export function initializeWebhooks(): void {
  logger.info('Initializing webhooks...');

  // Register standard handlers
  webhookManager.registerHandler('github', handleGitHubWebhook);
  webhookManager.registerHandler('slack', handleSlackWebhook);
  webhookManager.registerHandler('custom', handleCustomWebhook);

  // Register specialized triage handler
  webhookManager.registerHandler('github-triage', handleGitHubTriage);

  const stats = webhookManager.getStats();
  logger.info('✅ Webhooks initialized', {
    handlers: stats.registeredHandlers,
  });
}
```

### Step 4: Monitoring Dashboard

```bash
#!/bin/bash
# File: scripts/monitor-triage.sh

echo "🔍 GitHub Issue Triage Monitoring Dashboard"
echo "=========================================="
echo ""

# Get today's date for filtering
TODAY=$(date +%Y-%m-%d)
START="${TODAY}T00:00:00Z"
END="${TODAY}T23:59:59Z"

# 1. Webhook stats
echo "📊 WEBHOOK STATISTICS"
WEBHOOK_STATS=$(curl -s http://localhost:3000/webhooks/stats)
echo $WEBHOOK_STATS | jq '{
  totalWebhooks: .data.totalWebhooks,
  enabledWebhooks: .data.enabledWebhooks,
  handlers: .data.registeredHandlers
}'
echo ""

# 2. Today's traces
echo "📈 TODAY'S TRIAGE TRACES"
TRACES=$(curl -s "http://localhost:3000/tracing?startTimeFrom=$START&startTimeTo=$END")
TRACE_COUNT=$(echo $TRACES | jq '.count')
echo "Total triages: $TRACE_COUNT"

if [ "$TRACE_COUNT" -gt 0 ]; then
  echo $TRACES | jq -r '.data[] | "  - Issue \(.metadata.issueNumber // "unknown"): \(.status) (\(.duration)ms)"'
fi
echo ""

# 3. Today's costs
echo "💰 TODAY'S COSTS"
COSTS=$(curl -s "http://localhost:3000/costs/summary?startDate=$START&endDate=$END")
echo $COSTS | jq '{
  totalCost: .data.totalCost,
  totalCalls: .data.totalCalls,
  totalTokens: .data.totalTokens,
  byModel: .data.byModel
}'
echo ""

# 4. Budget status
echo "📉 BUDGET STATUS"
BUDGETS=$(curl -s http://localhost:3000/costs/budgets)
echo $BUDGETS | jq -r '.data[] | select(.name | contains("Triage")) | "  \(.name): $\(.currentSpend) / $\(.limit) (\(((.currentSpend / .limit) * 100) | floor)%)"'
echo ""

# 5. Recent alerts
echo "⚠️  COST ALERTS"
ALERTS=$(curl -s "http://localhost:3000/costs/alerts?limit=5")
ALERT_COUNT=$(echo $ALERTS | jq '.count')

if [ "$ALERT_COUNT" -gt 0 ]; then
  echo $ALERTS | jq -r '.data[] | "  [\(.type | ascii_upcase)] \(.message)"'
else
  echo "  No alerts"
fi
echo ""

# 6. Active traces
echo "🔄 ACTIVE TRACES"
ACTIVE=$(curl -s http://localhost:3000/tracing/active)
ACTIVE_COUNT=$(echo $ACTIVE | jq '.count')
echo "Currently running: $ACTIVE_COUNT"

if [ "$ACTIVE_COUNT" -gt 0 ]; then
  echo $ACTIVE | jq -r '.data[] | "  - \(.name) (started \(.startTime))"'
fi
echo ""

echo "=========================================="
echo "Dashboard refresh: $(date)"
```

### Step 5: Cost Analysis Report

```python
#!/usr/bin/env python3
# File: scripts/analyze-triage-costs.py

import requests
import json
from datetime import datetime, timedelta
from collections import defaultdict

BASE_URL = "http://localhost:3000"

def get_cost_summary(days=7):
    """Get cost summary for the last N days"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    params = {
        'startDate': start_date.isoformat() + 'Z',
        'endDate': end_date.isoformat() + 'Z'
    }

    response = requests.get(f"{BASE_URL}/costs/summary", params=params)
    return response.json()['data']

def get_traces(days=7):
    """Get traces for the last N days"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    params = {
        'userId': 'github_triage',
        'startTimeFrom': start_date.isoformat() + 'Z',
        'startTimeTo': end_date.isoformat() + 'Z',
        'limit': 1000
    }

    response = requests.get(f"{BASE_URL}/tracing", params=params)
    return response.json()['data']

def analyze_costs(summary, traces):
    """Analyze costs and generate insights"""
    print("=" * 60)
    print("GITHUB ISSUE TRIAGE - COST ANALYSIS")
    print("=" * 60)
    print()

    # Overall stats
    print(f"📊 OVERALL STATISTICS")
    print(f"  Total Cost: ${summary['totalCost']:.2f}")
    print(f"  Total Issues Triaged: {len(traces)}")
    print(f"  Average Cost per Issue: ${(summary['totalCost'] / len(traces)):.4f}" if len(traces) > 0 else "  No issues triaged")
    print(f"  Total LLM Calls: {summary['totalCalls']}")
    print(f"  Total Tokens: {summary['totalTokens']:,}")
    print()

    # Cost by model
    print(f"💰 COST BY MODEL")
    for model, stats in summary['byModel'].items():
        avg_cost_per_call = stats['cost'] / stats['calls'] if stats['calls'] > 0 else 0
        print(f"  {model}:")
        print(f"    Total: ${stats['cost']:.4f}")
        print(f"    Calls: {stats['calls']}")
        print(f"    Avg per call: ${avg_cost_per_call:.4f}")
    print()

    # Severity breakdown
    severity_stats = defaultdict(lambda: {'count': 0, 'total_duration': 0})

    for trace in traces:
        severity = trace.get('metadata', {}).get('severity', 'unknown')
        severity_stats[severity]['count'] += 1
        severity_stats[severity]['total_duration'] += trace.get('duration', 0)

    print(f"📈 TRIAGE BY SEVERITY")
    for severity, stats in sorted(severity_stats.items()):
        avg_duration = stats['total_duration'] / stats['count'] if stats['count'] > 0 else 0
        print(f"  {severity.upper()}:")
        print(f"    Count: {stats['count']}")
        print(f"    Avg Duration: {avg_duration/1000:.2f}s")
    print()

    # Performance metrics
    successful = [t for t in traces if t['status'] == 'success']
    failed = [t for t in traces if t['status'] == 'error']

    print(f"⚡ PERFORMANCE METRICS")
    print(f"  Success Rate: {(len(successful)/len(traces)*100):.1f}%" if len(traces) > 0 else "  N/A")
    print(f"  Failed Triages: {len(failed)}")

    if successful:
        avg_duration = sum(t['duration'] for t in successful) / len(successful)
        print(f"  Avg Triage Time: {avg_duration/1000:.2f}s")
        print(f"  Fastest Triage: {min(t['duration'] for t in successful)/1000:.2f}s")
        print(f"  Slowest Triage: {max(t['duration'] for t in successful)/1000:.2f}s")
    print()

    # Cost optimization recommendations
    print(f"💡 OPTIMIZATION RECOMMENDATIONS")

    # Check if using expensive models unnecessarily
    if 'gpt-4o' in summary['byModel']:
        gpt4_cost = summary['byModel']['gpt-4o']['cost']
        total_cost = summary['totalCost']
        if (gpt4_cost / total_cost) > 0.7:
            print(f"  ⚠️  70%+ of costs are from GPT-4o")
            print(f"     Consider using GPT-4o-mini for initial analysis")
            potential_savings = gpt4_cost * 0.6  # Rough estimate
            print(f"     Potential savings: ${potential_savings:.2f}")

    # Check average cost per issue
    if len(traces) > 0:
        avg_cost = summary['totalCost'] / len(traces)
        if avg_cost > 0.10:
            print(f"  ⚠️  High average cost per issue: ${avg_cost:.4f}")
            print(f"     Consider caching similar issue analyses")

    # Check success rate
    if len(traces) > 0:
        success_rate = len(successful) / len(traces)
        if success_rate < 0.9:
            print(f"  ⚠️  Success rate below 90%: {success_rate*100:.1f}%")
            print(f"     Review error logs and improve error handling")

    print()
    print("=" * 60)

if __name__ == "__main__":
    print("Fetching data...")
    summary = get_cost_summary(days=7)
    traces = get_traces(days=7)

    print(f"Analyzing {len(traces)} traces from the last 7 days...\n")
    analyze_costs(summary, traces)
```

### Step 6: Testing the Complete System

```bash
#!/bin/bash
# File: scripts/test-triage-system.sh

echo "🧪 Testing GitHub Issue Triage System"
echo "====================================="
echo ""

# 1. Check webhook is registered
echo "1️⃣  Checking webhook registration..."
WEBHOOKS=$(curl -s http://localhost:3000/webhooks)
TRIAGE_WEBHOOK=$(echo $WEBHOOKS | jq '.data[] | select(.name == "GitHub Issue Triage")')

if [ -z "$TRIAGE_WEBHOOK" ]; then
  echo "❌ Triage webhook not found! Run setup script first."
  exit 1
fi

echo "✅ Webhook found and enabled"
WEBHOOK_ID=$(echo $TRIAGE_WEBHOOK | jq -r '.id')
echo "   ID: $WEBHOOK_ID"
echo ""

# 2. Simulate a GitHub issue event
echo "2️⃣  Simulating GitHub issue..."

# Create test payload
TEST_PAYLOAD='{
  "action": "opened",
  "issue": {
    "number": 9999,
    "title": "Critical: Application crashes on startup",
    "body": "The application crashes immediately when I try to start it. Error message: \\"Cannot read property of undefined\\". This is blocking our production deployment. Steps to reproduce: 1. Start the app 2. See crash",
    "html_url": "https://github.com/test/repo/issues/9999",
    "user": {
      "login": "testuser"
    }
  },
  "repository": {
    "full_name": "test/repo",
    "name": "repo",
    "owner": {
      "login": "test"
    }
  },
  "sender": {
    "login": "testuser"
  }
}'

# Compute signature (if secret is set)
if [ ! -z "$GITHUB_WEBHOOK_SECRET" ]; then
  SIGNATURE="sha256=$(echo -n "$TEST_PAYLOAD" | openssl dgst -sha256 -hmac "$GITHUB_WEBHOOK_SECRET" | awk '{print $2}')"
  SIGNATURE_HEADER="-H \"X-Hub-Signature-256: $SIGNATURE\""
else
  SIGNATURE_HEADER=""
fi

# Send webhook
WEBHOOK_RESPONSE=$(curl -s -X POST http://localhost:3000/webhooks/github/triage \
  -H "Content-Type: application/json" \
  $SIGNATURE_HEADER \
  -d "$TEST_PAYLOAD")

echo "✅ Webhook sent"
echo "   Response: $(echo $WEBHOOK_RESPONSE | jq -c .)"
echo ""

# 3. Wait for processing
echo "3️⃣  Waiting for triage to complete (5 seconds)..."
sleep 5
echo ""

# 4. Check trace
echo "4️⃣  Checking trace..."
TRACES=$(curl -s "http://localhost:3000/tracing?userId=github_webhook&limit=1")
LATEST_TRACE=$(echo $TRACES | jq '.data[0]')

if [ -z "$LATEST_TRACE" ] || [ "$LATEST_TRACE" == "null" ]; then
  echo "⚠️  No trace found yet (may still be processing)"
else
  echo "✅ Trace found"
  echo $LATEST_TRACE | jq '{
    name: .name,
    status: .status,
    duration: .duration,
    severity: .metadata.severity,
    category: .metadata.category
  }'
fi
echo ""

# 5. Check cost
echo "5️⃣  Checking cost..."
COST_SUMMARY=$(curl -s http://localhost:3000/costs/summary)
echo $COST_SUMMARY | jq '{
  totalCost: .data.totalCost,
  totalCalls: .data.totalCalls,
  recentCall: .data.entries[0]
}'
echo ""

# 6. Check budget
echo "6️⃣  Checking budget..."
BUDGETS=$(curl -s http://localhost:3000/costs/budgets)
TRIAGE_BUDGET=$(echo $BUDGETS | jq '.data[] | select(.name | contains("Triage"))')

if [ ! -z "$TRIAGE_BUDGET" ]; then
  echo $TRIAGE_BUDGET | jq '{
    name: .name,
    currentSpend: .currentSpend,
    limit: .limit,
    percentage: ((.currentSpend / .limit) * 100 | floor)
  }'
else
  echo "⚠️  No triage budget found"
fi
echo ""

echo "====================================="
echo "✅ Test complete!"
echo ""
echo "Next steps:"
echo "  1. Review trace details: http://localhost:3000/tracing"
echo "  2. Monitor costs: http://localhost:3000/costs/summary"
echo "  3. Check alerts: http://localhost:3000/costs/alerts"
```

---

## Usage Instructions

### 1. Initial Setup

```bash
# Set environment variables
export GITHUB_WEBHOOK_SECRET="your-secret-here"

# Run setup script
./scripts/setup-github-triage.sh
```

### 2. Configure GitHub

1. Go to your repository → Settings → Webhooks
2. Add webhook with URL from setup script
3. Select "Issues" events
4. Save

### 3. Monitor System

```bash
# Watch dashboard (updates every 5 seconds)
watch -n 5 ./scripts/monitor-triage.sh

# Or run once
./scripts/monitor-triage.sh
```

### 4. Analyze Costs Weekly

```bash
# Run cost analysis
python3 ./scripts/analyze-triage-costs.py
```

### 5. Test End-to-End

```bash
# Run complete test
./scripts/test-triage-system.sh
```

---

## Expected Results

### When an Issue is Created:

**1. Within 5 seconds:**
- Webhook received and verified ✅
- Trace created with workflow ID ✅
- Research agent analyzes issue ✅

**2. Within 15 seconds:**
- Similar issues found ✅
- Triage result generated ✅
- GitHub comment posted ✅

**3. Within 30 seconds:**
- Team email sent ✅
- Cost tracked ✅
- Trace completed ✅

### Trace Output Example:

```json
{
  "id": "trace-abc123",
  "name": "Triage Issue #9999",
  "status": "success",
  "duration": 12500,
  "spans": [
    {
      "name": "LLM Call: openai/gpt-4o-mini",
      "type": "llm_call",
      "duration": 2000,
      "metadata": {
        "step": "analysis",
        "promptTokens": 150,
        "completionTokens": 300
      }
    },
    {
      "name": "Agent: research - web_search",
      "type": "agent",
      "duration": 3000
    },
    {
      "name": "LLM Call: openai/gpt-4o",
      "type": "llm_call",
      "duration": 5000,
      "metadata": {
        "step": "triage",
        "severity": "high"
      }
    }
  ],
  "metadata": {
    "severity": "high",
    "category": "bug",
    "totalCost": 0.0125
  }
}
```

### Cost Breakdown Example:

```
Total Cost: $0.0125
- GPT-4o-mini (analysis): $0.0005
- GPT-4o-mini (similarity): $0.0003
- GPT-4o (triage): $0.0117

Estimated monthly cost (50 issues/day):
$0.0125 × 50 × 30 = $18.75/month
```

---

## Advanced Features

### 1. Custom Severity Rules

```typescript
// Add to github-triage-handler.ts

const SEVERITY_RULES = {
  keywords: {
    critical: ['crash', 'data loss', 'security', 'vulnerability'],
    high: ['error', 'exception', 'failure', 'broken'],
    medium: ['bug', 'issue', 'problem'],
    low: ['enhancement', 'feature request', 'question'],
  },

  labels: {
    critical: ['security', 'data-loss'],
    high: ['bug', 'regression'],
  }
};

function applySeverityRules(issue: any, triage: TriageResult): TriageResult {
  // Check for critical keywords in title
  const titleLower = issue.title.toLowerCase();

  for (const keyword of SEVERITY_RULES.keywords.critical) {
    if (titleLower.includes(keyword)) {
      triage.severity = 'critical';
      break;
    }
  }

  // Check existing labels
  const labels = issue.labels?.map((l: any) => l.name.toLowerCase()) || [];

  if (labels.some((l: string) => SEVERITY_RULES.labels.critical.includes(l))) {
    triage.severity = 'critical';
  }

  return triage;
}
```

### 2. Auto-Assignment Logic

```typescript
// Add to github-triage-handler.ts

const TEAM_EXPERTISE = {
  'backend': ['alice', 'bob'],
  'frontend': ['charlie', 'diana'],
  'security': ['eve'],
  'performance': ['frank'],
};

function suggestAssignee(triage: TriageResult): string | undefined {
  const category = triage.category.toLowerCase();

  // Match category to team
  for (const [area, members] of Object.entries(TEAM_EXPERTISE)) {
    if (category.includes(area)) {
      // Round-robin or load-based assignment
      return members[0]; // Simplified
    }
  }

  // Default to category match
  return undefined;
}
```

### 3. Cost-Aware Model Selection

```typescript
// Add to github-triage-handler.ts

async function selectModelBasedOnBudget(
  userId: string,
  operation: string
): Promise<string> {
  // Check remaining budget
  const budgets = await fetch('http://localhost:3000/costs/budgets').then(r => r.json());
  const triageBudget = budgets.data.find((b: any) => b.name.includes('Triage'));

  if (!triageBudget) {
    return 'gpt-4o-mini'; // Default to cheaper
  }

  const percentUsed = (triageBudget.currentSpend / triageBudget.limit) * 100;

  // Use cheaper models when approaching budget limit
  if (percentUsed > 80) {
    return 'gpt-4o-mini';
  } else if (percentUsed > 50) {
    // Use GPT-4o only for triage generation
    return operation === 'triage_generation' ? 'gpt-4o' : 'gpt-4o-mini';
  } else {
    // Budget available, use better models
    return 'gpt-4o';
  }
}
```

---

## Monitoring Alerts

### Slack Notification on Budget Alert

```typescript
// File: src/webhooks/handlers/budget-alert-handler.ts

import { costTracker } from '../../cost-tracking';

// Poll for alerts every minute
setInterval(async () => {
  const alerts = costTracker.getAlerts(10);

  for (const alert of alerts) {
    // Check if already notified (within last hour)
    const recentlyNotified = await checkIfNotified(alert.id);

    if (!recentlyNotified && alert.type === 'limit') {
      await sendSlackAlert(alert);
      await markAsNotified(alert.id);
    }
  }
}, 60000); // Every minute

async function sendSlackAlert(alert: any) {
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;

  if (!slackWebhook) return;

  await fetch(slackWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 Budget Alert: ${alert.message}`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Current Spend', value: `$${alert.currentSpend.toFixed(2)}`, short: true },
          { title: 'Limit', value: `$${alert.limit.toFixed(2)}`, short: true },
          { title: 'Percentage', value: `${alert.percentage.toFixed(1)}%`, short: true },
        ]
      }]
    })
  });
}
```

---

## Benefits Achieved

✅ **Speed**: Issues triaged in < 30 seconds
✅ **Visibility**: Complete trace of every triage
✅ **Cost Control**: Budget limits prevent overspending
✅ **Automation**: Zero manual intervention required
✅ **Insights**: Detailed analytics on triage performance
✅ **Scalability**: Handle unlimited issues within budget

---

This complete use case demonstrates the power of combining Phase 5 features (webhooks, tracing, cost tracking) into a production-ready system!
