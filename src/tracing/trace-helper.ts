import { traceManager } from './trace-manager';
import { Trace, TraceSpan, SpanOptions } from './trace-types';
import { logger } from '../utils/logger';

/**
 * Trace Helper
 * Provides convenient methods for adding tracing to operations
 */

/**
 * Active trace context (thread-local simulation)
 * In production, use AsyncLocalStorage for proper async context tracking
 */
class TraceContext {
  private currentTrace: Trace | null = null;
  private currentSpan: TraceSpan | null = null;

  setTrace(trace: Trace | null): void {
    this.currentTrace = trace;
  }

  getTrace(): Trace | null {
    return this.currentTrace;
  }

  setSpan(span: TraceSpan | null): void {
    this.currentSpan = span;
  }

  getSpan(): TraceSpan | null {
    return this.currentSpan;
  }

  clear(): void {
    this.currentTrace = null;
    this.currentSpan = null;
  }
}

export const traceContext = new TraceContext();

/**
 * Trace a function execution
 */
export async function traceFunction<T>(
  spanOptions: Omit<SpanOptions, 'metadata'> & { traceId?: string },
  fn: (span: TraceSpan) => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const trace = traceContext.getTrace();
  const traceId = spanOptions.traceId || trace?.id;

  if (!traceId) {
    logger.warn('No active trace for tracing function', { name: spanOptions.name });
    return fn({} as TraceSpan); // Execute without tracing
  }

  const span = traceManager.startSpan(traceId, {
    ...spanOptions,
    metadata,
  });

  if (!span) {
    logger.warn('Failed to start span', { traceId, name: spanOptions.name });
    return fn({} as TraceSpan); // Execute without tracing
  }

  const previousSpan = traceContext.getSpan();
  traceContext.setSpan(span);

  try {
    const result = await fn(span);
    traceManager.endSpan(traceId, span.id, 'success');
    return result;
  } catch (error) {
    traceManager.endSpan(traceId, span.id, 'error', error);
    throw error;
  } finally {
    traceContext.setSpan(previousSpan);
  }
}

/**
 * Trace an LLM call
 */
export async function traceLLMCall<T>(
  traceId: string,
  provider: string,
  model: string,
  fn: (span: TraceSpan) => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return traceFunction(
    {
      traceId,
      name: `LLM Call: ${provider}/${model}`,
      type: 'llm_call',
    },
    fn,
    {
      provider,
      model,
      ...metadata,
    }
  );
}

/**
 * Trace a RAG query
 */
export async function traceRAGQuery<T>(
  traceId: string,
  query: string,
  fn: (span: TraceSpan) => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return traceFunction(
    {
      traceId,
      name: 'RAG Query',
      type: 'rag_query',
    },
    fn,
    {
      query: query.substring(0, 200),
      ...metadata,
    }
  );
}

/**
 * Trace an agent execution
 */
export async function traceAgentExecution<T>(
  traceId: string,
  agentType: string,
  action: string,
  fn: (span: TraceSpan) => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return traceFunction(
    {
      traceId,
      name: `Agent: ${agentType} - ${action}`,
      type: 'agent',
    },
    fn,
    {
      agentType,
      action,
      ...metadata,
    }
  );
}

/**
 * Create a traced workflow execution
 */
export async function traceWorkflow<T>(
  userId: string,
  workflowName: string,
  workflowId: string | undefined,
  fn: (trace: Trace) => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const trace = traceManager.startTrace({
    userId,
    workflowId,
    name: workflowName,
    metadata,
  });

  const previousTrace = traceContext.getTrace();
  traceContext.setTrace(trace);

  try {
    const result = await fn(trace);
    traceManager.endTrace(trace.id, 'success');
    return result;
  } catch (error) {
    traceManager.endTrace(trace.id, 'error', error);
    throw error;
  } finally {
    traceContext.setTrace(previousTrace);
    traceContext.clear();
  }
}

/**
 * Add metadata to current span
 */
export function addSpanMetadata(metadata: Record<string, any>): void {
  const span = traceContext.getSpan();
  const trace = traceContext.getTrace();

  if (span && trace) {
    traceManager.updateSpanMetadata(trace.id, span.id, metadata);
  }
}

/**
 * Get current trace ID
 */
export function getCurrentTraceId(): string | null {
  const trace = traceContext.getTrace();
  return trace?.id || null;
}

/**
 * Get current span ID
 */
export function getCurrentSpanId(): string | null {
  const span = traceContext.getSpan();
  return span?.id || null;
}
