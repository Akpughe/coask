/**
 * Execution Tracing Types
 * Phase 5: External Integrations & Observability
 * Tracks workflow execution, timing, and results
 */

/**
 * Trace span represents a single unit of work
 */
export interface TraceSpan {
  id: string;
  traceId: string; // Parent trace ID
  parentSpanId?: string; // For nested spans
  name: string;
  type: 'workflow' | 'agent' | 'llm_call' | 'rag_query' | 'job' | 'custom';
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  status: 'running' | 'success' | 'error' | 'cancelled';
  metadata: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  tags: Record<string, string>;
}

/**
 * Trace represents an entire workflow execution
 */
export interface Trace {
  id: string;
  workflowId?: string;
  userId: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  status: 'running' | 'success' | 'error' | 'cancelled';
  spans: TraceSpan[];
  metadata: Record<string, any>;
  tags: Record<string, string>;
}

/**
 * Options for creating a new trace
 */
export interface TraceOptions {
  workflowId?: string;
  userId: string;
  name: string;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

/**
 * Options for creating a new span
 */
export interface SpanOptions {
  parentSpanId?: string;
  name: string;
  type: TraceSpan['type'];
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

/**
 * Trace query filters
 */
export interface TraceQuery {
  userId?: string;
  workflowId?: string;
  status?: Trace['status'];
  startTimeFrom?: Date;
  startTimeTo?: Date;
  tags?: Record<string, string>;
  limit?: number;
  offset?: number;
}

/**
 * Trace statistics
 */
export interface TraceStats {
  totalTraces: number;
  runningTraces: number;
  successTraces: number;
  errorTraces: number;
  averageDuration: number;
  totalDuration: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

/**
 * LLM call metadata for tracing
 */
export interface LLMCallMetadata {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
}

/**
 * RAG query metadata for tracing
 */
export interface RAGQueryMetadata {
  query: string;
  topK: number;
  resultsCount: number;
  sources: Array<{
    id: string;
    score: number;
    category?: string;
  }>;
}

/**
 * Agent execution metadata for tracing
 */
export interface AgentExecutionMetadata {
  agentType: string;
  action: string;
  inputSize?: number;
  outputSize?: number;
}
