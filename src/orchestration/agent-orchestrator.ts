import { StateGraph, END, START } from '@langchain/langgraph';
import { IAgent, AgentTask, AgentResult, agentRegistry } from '../agents/base-agent';
import { logger } from '../utils/logger';

/**
 * Workflow state - tracks the state through a workflow execution
 */
export interface WorkflowState {
  workflowId: string;
  userId: string;
  input: any;
  currentStep: string;
  stepResults: Record<string, any>;
  finalOutput?: any;
  error?: string;
  metadata: {
    startedAt: Date;
    completedAt?: Date;
    totalSteps: number;
    completedSteps: number;
  };
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  name: string;
  agentType: string;
  taskType: string;
  input: (state: WorkflowState) => any;
  next?: string | ((state: WorkflowState) => string);
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
  initialStep: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  workflowId: string;
  success: boolean;
  output?: any;
  error?: string;
  stepResults: Record<string, AgentResult>;
  metadata: {
    executionTime: number;
    totalSteps: number;
    completedSteps: number;
    startedAt: Date;
    completedAt: Date;
  };
}

/**
 * Agent Orchestrator
 * Coordinates multiple agents using LangGraph for workflow execution
 */
export class AgentOrchestrator {
  constructor() {
    logger.info('✅ Agent Orchestrator initialized');
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflow: WorkflowDefinition,
    userId: string,
    input: any
  ): Promise<WorkflowExecutionResult> {
    const workflowId = this.generateWorkflowId();
    const startTime = Date.now();

    logger.info('Executing workflow', {
      workflowId,
      workflowName: workflow.name,
      userId,
    });

    // Initialize workflow state
    const initialState: WorkflowState = {
      workflowId,
      userId,
      input,
      currentStep: workflow.initialStep,
      stepResults: {},
      metadata: {
        startedAt: new Date(),
        totalSteps: workflow.steps.length,
        completedSteps: 0,
      },
    };

    try {
      // Build and execute the graph
      const graph = this.buildWorkflowGraph(workflow);
      const finalState = await this.executeGraph(graph, initialState, workflow);

      const executionTime = Date.now() - startTime;

      logger.info('Workflow completed successfully', {
        workflowId,
        executionTime: `${executionTime}ms`,
        completedSteps: finalState.metadata.completedSteps,
      });

      return {
        workflowId,
        success: true,
        output: finalState.finalOutput,
        stepResults: this.convertToAgentResults(finalState.stepResults),
        metadata: {
          executionTime,
          totalSteps: finalState.metadata.totalSteps,
          completedSteps: finalState.metadata.completedSteps,
          startedAt: finalState.metadata.startedAt,
          completedAt: new Date(),
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error('Workflow execution failed', error, { workflowId });

      return {
        workflowId,
        success: false,
        error: error.message,
        stepResults: {},
        metadata: {
          executionTime,
          totalSteps: workflow.steps.length,
          completedSteps: 0,
          startedAt: initialState.metadata.startedAt,
          completedAt: new Date(),
        },
      };
    }
  }

  /**
   * Build LangGraph workflow graph from workflow definition
   */
  private buildWorkflowGraph(workflow: WorkflowDefinition): any {
    // For Phase 3, we'll use a simplified approach
    // LangGraph integration can be enhanced in future phases
    // Returning null for now as we're using simplified execution
    return null;
  }

  /**
   * Execute the workflow graph
   * Simplified execution for Phase 3
   */
  private async executeGraph(
    graph: any,
    initialState: WorkflowState,
    workflow: WorkflowDefinition
  ): Promise<WorkflowState> {
    let currentState = { ...initialState };
    let currentStepName = workflow.initialStep;

    while (currentStepName && currentStepName !== 'END') {
      const step = workflow.steps.find((s) => s.name === currentStepName);
      if (!step) {
        throw new Error(`Step not found: ${currentStepName}`);
      }

      logger.debug('Executing step', { step: step.name, workflowId: currentState.workflowId });

      // Execute the step
      const stepResult = await this.executeStep(step, currentState);
      currentState.stepResults[step.name] = stepResult;
      currentState.metadata.completedSteps++;

      // Determine next step
      if (typeof step.next === 'function') {
        currentStepName = step.next(currentState);
      } else {
        currentStepName = step.next || 'END';
      }

      currentState.currentStep = currentStepName;
    }

    // Set final output from last step result
    const lastStepName = Object.keys(currentState.stepResults).pop();
    if (lastStepName) {
      currentState.finalOutput = currentState.stepResults[lastStepName];
    }

    currentState.metadata.completedAt = new Date();

    return currentState;
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: WorkflowStep, state: WorkflowState): Promise<any> {
    // Find the agent for this step
    const agent = agentRegistry.getAgent(step.agentType);
    if (!agent) {
      throw new Error(`Agent not found for type: ${step.agentType}`);
    }

    // Get input for this step
    const stepInput = step.input(state);

    // Create agent task
    const task: AgentTask = {
      id: this.generateTaskId(),
      type: step.taskType,
      input: stepInput,
      context: {
        userId: state.userId,
        conversationId: state.workflowId,
      },
      createdAt: new Date(),
    };

    // Execute the task
    const result = await agent.execute(task);

    if (!result.success) {
      throw new Error(`Step ${step.name} failed: ${result.error}`);
    }

    return result.output;
  }

  /**
   * Convert step results to AgentResult format
   */
  private convertToAgentResults(stepResults: Record<string, any>): Record<string, AgentResult> {
    const agentResults: Record<string, AgentResult> = {};

    for (const [stepName, output] of Object.entries(stepResults)) {
      agentResults[stepName] = {
        taskId: this.generateTaskId(),
        agentType: 'unknown',
        success: true,
        output,
        completedAt: new Date(),
      };
    }

    return agentResults;
  }

  /**
   * Execute a simple sequential multi-agent workflow
   */
  async executeSequentialWorkflow(
    userId: string,
    tasks: Array<{ agentType: string; taskType: string; input: any }>
  ): Promise<WorkflowExecutionResult> {
    const workflowId = this.generateWorkflowId();
    const startTime = Date.now();

    logger.info('Executing sequential workflow', {
      workflowId,
      userId,
      taskCount: tasks.length,
    });

    const stepResults: Record<string, AgentResult> = {};
    let previousOutput: any = null;

    try {
      for (let i = 0; i < tasks.length; i++) {
        const taskDef = tasks[i];
        const agent = agentRegistry.getAgent(taskDef.agentType);

        if (!agent) {
          throw new Error(`Agent not found: ${taskDef.agentType}`);
        }

        // Create task with access to previous output
        const task: AgentTask = {
          id: this.generateTaskId(),
          type: taskDef.taskType,
          input: {
            ...taskDef.input,
            previousOutput,
          },
          context: {
            userId,
            conversationId: workflowId,
          },
          createdAt: new Date(),
        };

        logger.debug(`Executing task ${i + 1}/${tasks.length}`, {
          agentType: taskDef.agentType,
          taskType: taskDef.taskType,
        });

        const result = await agent.execute(task);
        stepResults[`step_${i + 1}`] = result;

        if (!result.success) {
          throw new Error(`Task ${i + 1} failed: ${result.error}`);
        }

        previousOutput = result.output;
      }

      const executionTime = Date.now() - startTime;

      logger.info('Sequential workflow completed', {
        workflowId,
        executionTime: `${executionTime}ms`,
      });

      return {
        workflowId,
        success: true,
        output: previousOutput,
        stepResults,
        metadata: {
          executionTime,
          totalSteps: tasks.length,
          completedSteps: tasks.length,
          startedAt: new Date(startTime),
          completedAt: new Date(),
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error('Sequential workflow failed', error, { workflowId });

      return {
        workflowId,
        success: false,
        error: error.message,
        stepResults,
        metadata: {
          executionTime,
          totalSteps: tasks.length,
          completedSteps: Object.keys(stepResults).length,
          startedAt: new Date(startTime),
          completedAt: new Date(),
        },
      };
    }
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

// Export singleton instance
export const agentOrchestrator = new AgentOrchestrator();
