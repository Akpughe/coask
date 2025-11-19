import { WorkflowDefinition, WorkflowState } from './agent-orchestrator';
import { ResearchTaskType } from '../agents/research-agent';

/**
 * Predefined Workflows
 * These are common multi-agent workflows that can be executed
 */

/**
 * Research and Email Workflow
 * 1. Research a topic
 * 2. Draft an email based on research
 */
export const researchAndEmailWorkflow: WorkflowDefinition = {
  name: 'research_and_email',
  description: 'Research a topic and draft an email with findings',
  initialStep: 'research',
  steps: [
    {
      name: 'research',
      agentType: 'research',
      taskType: ResearchTaskType.WEB_SEARCH,
      input: (state: WorkflowState) => ({
        query: state.input.researchQuery,
        userId: state.userId,
        saveToKnowledgeBase: state.input.saveToKnowledgeBase || true,
        category: state.input.category || 'research',
      }),
      next: 'draft_email',
    },
    {
      name: 'draft_email',
      agentType: 'email',
      taskType: 'email.draft',
      input: (state: WorkflowState) => {
        const researchResult = state.stepResults['research'];
        return {
          userId: state.userId,
          to: state.input.emailTo,
          subject: state.input.emailSubject || `Research findings: ${state.input.researchQuery}`,
          context: researchResult?.synthesis || 'Research findings',
          tone: state.input.tone || 'professional',
          length: state.input.length || 'medium',
          useRAG: true,
        };
      },
      next: 'END',
    },
  ],
};

/**
 * Summarize and Save Workflow
 * 1. Summarize text
 * 2. Save to knowledge base
 */
export const summarizeAndSaveWorkflow: WorkflowDefinition = {
  name: 'summarize_and_save',
  description: 'Summarize text and save to knowledge base',
  initialStep: 'summarize',
  steps: [
    {
      name: 'summarize',
      agentType: 'research',
      taskType: ResearchTaskType.SUMMARIZE,
      input: (state: WorkflowState) => ({
        text: state.input.text,
        userId: state.userId,
        maxLength: state.input.maxLength || 'medium',
      }),
      next: 'END',
    },
  ],
};

/**
 * Analyze and Report Workflow
 * 1. Analyze text
 * 2. Extract key information
 * 3. Generate summary report email
 */
export const analyzeAndReportWorkflow: WorkflowDefinition = {
  name: 'analyze_and_report',
  description: 'Analyze text and generate a report email',
  initialStep: 'analyze',
  steps: [
    {
      name: 'analyze',
      agentType: 'research',
      taskType: ResearchTaskType.ANALYZE,
      input: (state: WorkflowState) => ({
        text: state.input.text,
        userId: state.userId,
        analysisType: state.input.analysisType || 'insights',
      }),
      next: 'extract_info',
    },
    {
      name: 'extract_info',
      agentType: 'research',
      taskType: ResearchTaskType.EXTRACT_INFO,
      input: (state: WorkflowState) => ({
        text: state.input.text,
        userId: state.userId,
        extractType: 'keywords',
      }),
      next: 'generate_report',
    },
    {
      name: 'generate_report',
      agentType: 'email',
      taskType: 'email.draft',
      input: (state: WorkflowState) => {
        const analysis = state.stepResults['analyze'];
        const keywords = state.stepResults['extract_info'];

        const reportContext = `Analysis Results:
${JSON.stringify(analysis?.analysis, null, 2)}

Key Keywords:
${JSON.stringify(keywords?.extracted, null, 2)}

Please generate a professional report summarizing these findings.`;

        return {
          userId: state.userId,
          to: state.input.reportTo,
          subject: state.input.reportSubject || 'Analysis Report',
          context: reportContext,
          tone: 'professional',
          length: 'long',
        };
      },
      next: 'END',
    },
  ],
};

/**
 * Knowledge-Enhanced Email Workflow
 * 1. Query knowledge base
 * 2. Draft email with RAG context
 */
export const knowledgeEnhancedEmailWorkflow: WorkflowDefinition = {
  name: 'knowledge_enhanced_email',
  description: 'Draft an email enhanced with knowledge base context',
  initialStep: 'draft_email',
  steps: [
    {
      name: 'draft_email',
      agentType: 'email',
      taskType: 'email.draft',
      input: (state: WorkflowState) => ({
        userId: state.userId,
        to: state.input.to,
        subject: state.input.subject,
        context: state.input.context,
        tone: state.input.tone || 'professional',
        length: state.input.length || 'medium',
        useRAG: true,
        ragCategory: state.input.ragCategory,
      }),
      next: 'END',
    },
  ],
};

/**
 * Workflow Registry
 * Maps workflow names to their definitions
 */
export const workflowRegistry: Record<string, WorkflowDefinition> = {
  research_and_email: researchAndEmailWorkflow,
  summarize_and_save: summarizeAndSaveWorkflow,
  analyze_and_report: analyzeAndReportWorkflow,
  knowledge_enhanced_email: knowledgeEnhancedEmailWorkflow,
};

/**
 * Get workflow by name
 */
export function getWorkflow(name: string): WorkflowDefinition | undefined {
  return workflowRegistry[name];
}

/**
 * Get all workflow names
 */
export function getAllWorkflowNames(): string[] {
  return Object.keys(workflowRegistry);
}

/**
 * Get all workflows with metadata
 */
export function getAllWorkflows(): Array<{ name: string; description: string; steps: number }> {
  return Object.values(workflowRegistry).map((workflow) => ({
    name: workflow.name,
    description: workflow.description,
    steps: workflow.steps.length,
  }));
}
