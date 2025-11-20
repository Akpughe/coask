import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  Trace,
  TraceSpan,
  TraceOptions,
  SpanOptions,
  TraceQuery,
  TraceStats,
} from './trace-types';

/**
 * Trace Manager
 * Manages execution tracing for workflows and operations
 */
export class TraceManager {
  private traces: Map<string, Trace> = new Map();
  private activeTraces: Set<string> = new Set();

  // In-memory store for demo; in production, use database
  private readonly MAX_TRACES = 1000;

  constructor() {
    logger.info('✅ Trace Manager initialized');
  }

  /**
   * Start a new trace
   */
  startTrace(options: TraceOptions): Trace {
    const trace: Trace = {
      id: uuidv4(),
      workflowId: options.workflowId,
      userId: options.userId,
      name: options.name,
      startTime: new Date(),
      status: 'running',
      spans: [],
      metadata: options.metadata || {},
      tags: options.tags || {},
    };

    this.traces.set(trace.id, trace);
    this.activeTraces.add(trace.id);

    // Limit memory usage
    if (this.traces.size > this.MAX_TRACES) {
      this.cleanupOldTraces();
    }

    logger.debug('Trace started', {
      traceId: trace.id,
      name: trace.name,
      workflowId: trace.workflowId,
    });

    return trace;
  }

  /**
   * End a trace
   */
  endTrace(traceId: string, status: 'success' | 'error' | 'cancelled', error?: any): Trace | null {
    const trace = this.traces.get(traceId);

    if (!trace) {
      logger.warn('Trace not found', { traceId });
      return null;
    }

    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    trace.status = status;

    if (error) {
      trace.metadata.error = {
        message: error.message || 'Unknown error',
        stack: error.stack,
        code: error.code,
      };
    }

    this.activeTraces.delete(traceId);

    logger.info('Trace ended', {
      traceId: trace.id,
      name: trace.name,
      status: trace.status,
      duration: trace.duration,
      spans: trace.spans.length,
    });

    return trace;
  }

  /**
   * Start a new span within a trace
   */
  startSpan(traceId: string, options: SpanOptions): TraceSpan | null {
    const trace = this.traces.get(traceId);

    if (!trace) {
      logger.warn('Trace not found for span', { traceId });
      return null;
    }

    const span: TraceSpan = {
      id: uuidv4(),
      traceId,
      parentSpanId: options.parentSpanId,
      name: options.name,
      type: options.type,
      startTime: new Date(),
      status: 'running',
      metadata: options.metadata || {},
      tags: options.tags || {},
    };

    trace.spans.push(span);

    logger.debug('Span started', {
      traceId,
      spanId: span.id,
      name: span.name,
      type: span.type,
    });

    return span;
  }

  /**
   * End a span
   */
  endSpan(
    traceId: string,
    spanId: string,
    status: 'success' | 'error' | 'cancelled',
    error?: any
  ): TraceSpan | null {
    const trace = this.traces.get(traceId);

    if (!trace) {
      logger.warn('Trace not found for ending span', { traceId, spanId });
      return null;
    }

    const span = trace.spans.find((s) => s.id === spanId);

    if (!span) {
      logger.warn('Span not found', { traceId, spanId });
      return null;
    }

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = status;

    if (error) {
      span.error = {
        message: error.message || 'Unknown error',
        stack: error.stack,
        code: error.code,
      };
    }

    logger.debug('Span ended', {
      traceId,
      spanId: span.id,
      name: span.name,
      status: span.status,
      duration: span.duration,
    });

    return span;
  }

  /**
   * Update span metadata
   */
  updateSpanMetadata(traceId: string, spanId: string, metadata: Record<string, any>): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find((s) => s.id === spanId);
    if (!span) return;

    span.metadata = { ...span.metadata, ...metadata };
  }

  /**
   * Get a trace by ID
   */
  getTrace(traceId: string): Trace | null {
    return this.traces.get(traceId) || null;
  }

  /**
   * Query traces with filters
   */
  queryTraces(query: TraceQuery): Trace[] {
    let results = Array.from(this.traces.values());

    // Filter by userId
    if (query.userId) {
      results = results.filter((t) => t.userId === query.userId);
    }

    // Filter by workflowId
    if (query.workflowId) {
      results = results.filter((t) => t.workflowId === query.workflowId);
    }

    // Filter by status
    if (query.status) {
      results = results.filter((t) => t.status === query.status);
    }

    // Filter by time range
    if (query.startTimeFrom) {
      results = results.filter((t) => t.startTime >= query.startTimeFrom!);
    }

    if (query.startTimeTo) {
      results = results.filter((t) => t.startTime <= query.startTimeTo!);
    }

    // Filter by tags
    if (query.tags) {
      results = results.filter((t) => {
        return Object.entries(query.tags!).every(([key, value]) => t.tags[key] === value);
      });
    }

    // Sort by start time (most recent first)
    results.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get active traces
   */
  getActiveTraces(): Trace[] {
    return Array.from(this.activeTraces)
      .map((id) => this.traces.get(id))
      .filter((t): t is Trace => t !== undefined);
  }

  /**
   * Get trace statistics
   */
  getStats(): TraceStats {
    const traces = Array.from(this.traces.values());

    const stats: TraceStats = {
      totalTraces: traces.length,
      runningTraces: this.activeTraces.size,
      successTraces: traces.filter((t) => t.status === 'success').length,
      errorTraces: traces.filter((t) => t.status === 'error').length,
      averageDuration: 0,
      totalDuration: 0,
      byType: {},
      byStatus: {},
    };

    // Calculate durations
    const completedTraces = traces.filter((t) => t.duration !== undefined);
    if (completedTraces.length > 0) {
      stats.totalDuration = completedTraces.reduce((sum, t) => sum + (t.duration || 0), 0);
      stats.averageDuration = stats.totalDuration / completedTraces.length;
    }

    // Count by status
    traces.forEach((trace) => {
      stats.byStatus[trace.status] = (stats.byStatus[trace.status] || 0) + 1;

      // Count spans by type
      trace.spans.forEach((span) => {
        stats.byType[span.type] = (stats.byType[span.type] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * Delete a trace
   */
  deleteTrace(traceId: string): boolean {
    const deleted = this.traces.delete(traceId);
    this.activeTraces.delete(traceId);

    if (deleted) {
      logger.debug('Trace deleted', { traceId });
    }

    return deleted;
  }

  /**
   * Clear all traces
   */
  clearAll(): void {
    const count = this.traces.size;
    this.traces.clear();
    this.activeTraces.clear();

    logger.info('All traces cleared', { count });
  }

  /**
   * Cleanup old traces to prevent memory issues
   */
  private cleanupOldTraces(): void {
    const traces = Array.from(this.traces.values());

    // Sort by start time (oldest first)
    traces.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Remove oldest 20% of traces
    const toRemove = Math.floor(traces.length * 0.2);

    for (let i = 0; i < toRemove; i++) {
      const trace = traces[i];
      if (trace.status !== 'running') {
        this.traces.delete(trace.id);
      }
    }

    logger.debug('Cleaned up old traces', { removed: toRemove });
  }

  /**
   * Export traces for analysis
   */
  exportTraces(query?: TraceQuery): string {
    const traces = query ? this.queryTraces(query) : Array.from(this.traces.values());

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        count: traces.length,
        traces,
      },
      null,
      2
    );
  }
}

export const traceManager = new TraceManager();
