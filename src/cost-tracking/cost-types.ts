/**
 * Cost Tracking Types
 * Phase 5: External Integrations & Observability
 * Tracks LLM API usage and costs
 */

/**
 * LLM provider pricing configuration
 */
export interface LLMProviderPricing {
  provider: string;
  model: string;
  inputCostPer1kTokens: number; // USD per 1k tokens
  outputCostPer1kTokens: number; // USD per 1k tokens
  currency: string;
}

/**
 * Cost entry for a single LLM call
 */
export interface CostEntry {
  id: string;
  timestamp: Date;
  userId: string;
  provider: string;
  model: string;
  operation: string; // 'chat', 'completion', 'embedding', etc.
  traceId?: string;
  spanId?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  metadata?: Record<string, any>;
}

/**
 * Cost summary for a user or workflow
 */
export interface CostSummary {
  userId?: string;
  workflowId?: string;
  traceId?: string;
  startDate: Date;
  endDate: Date;
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  currency: string;
  byProvider: Record<
    string,
    {
      cost: number;
      tokens: number;
      calls: number;
    }
  >;
  byModel: Record<
    string,
    {
      cost: number;
      tokens: number;
      calls: number;
    }
  >;
  entries: CostEntry[];
}

/**
 * Cost query filters
 */
export interface CostQuery {
  userId?: string;
  provider?: string;
  model?: string;
  traceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Cost budget configuration
 */
export interface CostBudget {
  id: string;
  userId?: string; // If set, applies to specific user
  name: string;
  limit: number; // USD
  period: 'daily' | 'weekly' | 'monthly';
  alertThreshold: number; // Percentage (e.g., 80 = alert at 80%)
  enabled: boolean;
  currentSpend: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Cost alert
 */
export interface CostAlert {
  id: string;
  budgetId: string;
  timestamp: Date;
  type: 'threshold' | 'limit';
  currentSpend: number;
  limit: number;
  percentage: number;
  message: string;
}
