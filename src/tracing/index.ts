/**
 * Tracing Module
 * Phase 5: External Integrations & Observability
 */

export {
  Trace,
  TraceSpan,
  TraceOptions,
  SpanOptions,
  TraceQuery,
  TraceStats,
  LLMCallMetadata,
  RAGQueryMetadata,
  AgentExecutionMetadata,
} from './trace-types';

export { TraceManager, traceManager } from './trace-manager';

export {
  traceContext,
  traceFunction,
  traceLLMCall,
  traceRAGQuery,
  traceAgentExecution,
  traceWorkflow,
  addSpanMetadata,
  getCurrentTraceId,
  getCurrentSpanId,
} from './trace-helper';
