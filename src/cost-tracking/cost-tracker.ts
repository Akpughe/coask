import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  CostEntry,
  CostSummary,
  CostQuery,
  CostBudget,
  CostAlert,
  LLMProviderPricing,
} from './cost-types';

/**
 * Default pricing for common LLM models
 * Prices as of 2024 (should be updated regularly)
 */
const DEFAULT_PRICING: LLMProviderPricing[] = [
  // OpenAI
  { provider: 'openai', model: 'gpt-4o', inputCostPer1kTokens: 0.0025, outputCostPer1kTokens: 0.01, currency: 'USD' },
  { provider: 'openai', model: 'gpt-4o-mini', inputCostPer1kTokens: 0.00015, outputCostPer1kTokens: 0.0006, currency: 'USD' },
  { provider: 'openai', model: 'gpt-4-turbo', inputCostPer1kTokens: 0.01, outputCostPer1kTokens: 0.03, currency: 'USD' },
  { provider: 'openai', model: 'gpt-3.5-turbo', inputCostPer1kTokens: 0.0005, outputCostPer1kTokens: 0.0015, currency: 'USD' },

  // Anthropic
  { provider: 'anthropic', model: 'claude-3-5-sonnet', inputCostPer1kTokens: 0.003, outputCostPer1kTokens: 0.015, currency: 'USD' },
  { provider: 'anthropic', model: 'claude-3-opus', inputCostPer1kTokens: 0.015, outputCostPer1kTokens: 0.075, currency: 'USD' },
  { provider: 'anthropic', model: 'claude-3-haiku', inputCostPer1kTokens: 0.00025, outputCostPer1kTokens: 0.00125, currency: 'USD' },

  // Google
  { provider: 'google', model: 'gemini-1.5-pro', inputCostPer1kTokens: 0.00125, outputCostPer1kTokens: 0.005, currency: 'USD' },
  { provider: 'google', model: 'gemini-1.5-flash', inputCostPer1kTokens: 0.000075, outputCostPer1kTokens: 0.0003, currency: 'USD' },
];

/**
 * Cost Tracker
 * Tracks LLM API usage and costs
 */
export class CostTracker {
  private entries: Map<string, CostEntry> = new Map();
  private pricing: Map<string, LLMProviderPricing> = new Map();
  private budgets: Map<string, CostBudget> = new Map();
  private alerts: CostAlert[] = [];

  private readonly MAX_ENTRIES = 10000;

  constructor() {
    this.initializePricing();
    logger.info('✅ Cost Tracker initialized');
  }

  /**
   * Initialize default pricing
   */
  private initializePricing(): void {
    DEFAULT_PRICING.forEach((price) => {
      const key = `${price.provider}:${price.model}`;
      this.pricing.set(key, price);
    });

    logger.debug('LLM pricing initialized', {
      providers: DEFAULT_PRICING.map((p) => `${p.provider}/${p.model}`),
    });
  }

  /**
   * Track a cost entry
   */
  trackCost(params: {
    userId: string;
    provider: string;
    model: string;
    operation: string;
    promptTokens: number;
    completionTokens: number;
    traceId?: string;
    spanId?: string;
    metadata?: Record<string, any>;
  }): CostEntry {
    const pricing = this.getPricing(params.provider, params.model);

    const inputCost = (params.promptTokens / 1000) * pricing.inputCostPer1kTokens;
    const outputCost = (params.completionTokens / 1000) * pricing.outputCostPer1kTokens;

    const entry: CostEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      operation: params.operation,
      traceId: params.traceId,
      spanId: params.spanId,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.promptTokens + params.completionTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: pricing.currency,
      metadata: params.metadata,
    };

    this.entries.set(entry.id, entry);

    // Limit memory usage
    if (this.entries.size > this.MAX_ENTRIES) {
      this.cleanupOldEntries();
    }

    // Check budgets
    this.checkBudgets(params.userId, entry.totalCost);

    logger.debug('Cost tracked', {
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      cost: entry.totalCost.toFixed(4),
      tokens: entry.totalTokens,
    });

    return entry;
  }

  /**
   * Get pricing for a provider/model
   */
  getPricing(provider: string, model: string): LLMProviderPricing {
    const key = `${provider}:${model}`;
    const pricing = this.pricing.get(key);

    if (pricing) {
      return pricing;
    }

    // Return default fallback pricing
    logger.warn('Pricing not found, using fallback', { provider, model });

    return {
      provider,
      model,
      inputCostPer1kTokens: 0.001,
      outputCostPer1kTokens: 0.002,
      currency: 'USD',
    };
  }

  /**
   * Set custom pricing
   */
  setPricing(pricing: LLMProviderPricing): void {
    const key = `${pricing.provider}:${pricing.model}`;
    this.pricing.set(key, pricing);

    logger.info('Custom pricing set', {
      provider: pricing.provider,
      model: pricing.model,
      inputCost: pricing.inputCostPer1kTokens,
      outputCost: pricing.outputCostPer1kTokens,
    });
  }

  /**
   * Get cost summary
   */
  getCostSummary(query: CostQuery): CostSummary {
    const entries = this.queryCosts(query);

    const startDate = query.startDate || new Date(0);
    const endDate = query.endDate || new Date();

    const summary: CostSummary = {
      userId: query.userId,
      traceId: query.traceId,
      startDate,
      endDate,
      totalCost: 0,
      totalTokens: 0,
      totalCalls: entries.length,
      currency: 'USD',
      byProvider: {},
      byModel: {},
      entries,
    };

    entries.forEach((entry) => {
      summary.totalCost += entry.totalCost;
      summary.totalTokens += entry.totalTokens;

      // By provider
      if (!summary.byProvider[entry.provider]) {
        summary.byProvider[entry.provider] = { cost: 0, tokens: 0, calls: 0 };
      }
      summary.byProvider[entry.provider].cost += entry.totalCost;
      summary.byProvider[entry.provider].tokens += entry.totalTokens;
      summary.byProvider[entry.provider].calls += 1;

      // By model
      if (!summary.byModel[entry.model]) {
        summary.byModel[entry.model] = { cost: 0, tokens: 0, calls: 0 };
      }
      summary.byModel[entry.model].cost += entry.totalCost;
      summary.byModel[entry.model].tokens += entry.totalTokens;
      summary.byModel[entry.model].calls += 1;
    });

    return summary;
  }

  /**
   * Query cost entries
   */
  queryCosts(query: CostQuery): CostEntry[] {
    let results = Array.from(this.entries.values());

    // Filter by userId
    if (query.userId) {
      results = results.filter((e) => e.userId === query.userId);
    }

    // Filter by provider
    if (query.provider) {
      results = results.filter((e) => e.provider === query.provider);
    }

    // Filter by model
    if (query.model) {
      results = results.filter((e) => e.model === query.model);
    }

    // Filter by traceId
    if (query.traceId) {
      results = results.filter((e) => e.traceId === query.traceId);
    }

    // Filter by date range
    if (query.startDate) {
      results = results.filter((e) => e.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter((e) => e.timestamp <= query.endDate!);
    }

    // Sort by timestamp (most recent first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    return results.slice(offset, offset + limit);
  }

  /**
   * Create a budget
   */
  createBudget(budget: Omit<CostBudget, 'id' | 'currentSpend' | 'periodStart' | 'periodEnd'>): CostBudget {
    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, budget.period);

    const newBudget: CostBudget = {
      ...budget,
      id: uuidv4(),
      currentSpend: 0,
      periodStart: now,
      periodEnd,
    };

    this.budgets.set(newBudget.id, newBudget);

    logger.info('Budget created', {
      id: newBudget.id,
      name: newBudget.name,
      limit: newBudget.limit,
      period: newBudget.period,
    });

    return newBudget;
  }

  /**
   * Check budgets and generate alerts
   */
  private checkBudgets(userId: string, cost: number): void {
    // Find applicable budgets
    const applicableBudgets = Array.from(this.budgets.values()).filter(
      (b) => b.enabled && (!b.userId || b.userId === userId)
    );

    for (const budget of applicableBudgets) {
      // Reset budget if period expired
      if (new Date() > budget.periodEnd) {
        this.resetBudget(budget.id);
        continue;
      }

      budget.currentSpend += cost;

      const percentage = (budget.currentSpend / budget.limit) * 100;

      // Check threshold alert
      if (percentage >= budget.alertThreshold && percentage < 100) {
        this.createAlert(budget, 'threshold', percentage);
      }

      // Check limit alert
      if (percentage >= 100) {
        this.createAlert(budget, 'limit', percentage);
      }
    }
  }

  /**
   * Reset budget for new period
   */
  private resetBudget(budgetId: string): void {
    const budget = this.budgets.get(budgetId);
    if (!budget) return;

    const now = new Date();
    budget.currentSpend = 0;
    budget.periodStart = now;
    budget.periodEnd = this.calculatePeriodEnd(now, budget.period);

    logger.info('Budget reset', { id: budget.id, period: budget.period });
  }

  /**
   * Calculate period end date
   */
  private calculatePeriodEnd(start: Date, period: CostBudget['period']): Date {
    const end = new Date(start);

    switch (period) {
      case 'daily':
        end.setDate(end.getDate() + 1);
        break;
      case 'weekly':
        end.setDate(end.getDate() + 7);
        break;
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        break;
    }

    return end;
  }

  /**
   * Create a cost alert
   */
  private createAlert(budget: CostBudget, type: 'threshold' | 'limit', percentage: number): void {
    // Avoid duplicate alerts
    const recentAlerts = this.alerts.filter(
      (a) =>
        a.budgetId === budget.id &&
        a.type === type &&
        new Date().getTime() - a.timestamp.getTime() < 3600000 // 1 hour
    );

    if (recentAlerts.length > 0) {
      return;
    }

    const alert: CostAlert = {
      id: uuidv4(),
      budgetId: budget.id,
      timestamp: new Date(),
      type,
      currentSpend: budget.currentSpend,
      limit: budget.limit,
      percentage,
      message:
        type === 'threshold'
          ? `Budget '${budget.name}' has reached ${percentage.toFixed(1)}% of limit`
          : `Budget '${budget.name}' has exceeded the limit!`,
    };

    this.alerts.push(alert);

    logger.warn('Cost alert generated', {
      budget: budget.name,
      type,
      percentage: percentage.toFixed(1),
      currentSpend: budget.currentSpend.toFixed(2),
      limit: budget.limit,
    });
  }

  /**
   * Get all budgets
   */
  getBudgets(): CostBudget[] {
    return Array.from(this.budgets.values());
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 50): CostAlert[] {
    return this.alerts.slice(-limit).reverse();
  }

  /**
   * Cleanup old entries
   */
  private cleanupOldEntries(): void {
    const entries = Array.from(this.entries.values());

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Remove oldest 20%
    const toRemove = Math.floor(entries.length * 0.2);

    for (let i = 0; i < toRemove; i++) {
      this.entries.delete(entries[i].id);
    }

    logger.debug('Cleaned up old cost entries', { removed: toRemove });
  }

  /**
   * Export cost data
   */
  exportCosts(query?: CostQuery): string {
    const summary = this.getCostSummary(query || {});

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        summary,
      },
      null,
      2
    );
  }
}

export const costTracker = new CostTracker();
