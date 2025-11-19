import express, { Router, Request, Response } from 'express';
import { agentOrchestrator } from '../orchestration/agent-orchestrator';
import { getWorkflow, getAllWorkflows } from '../orchestration/workflows';
import { agentRegistry } from '../agents/base-agent';
import { logger } from '../utils/logger';

const router: Router = express.Router();

/**
 * GET /orchestration/workflows
 * List all available workflows
 */
router.get('/workflows', (req: Request, res: Response) => {
  try {
    logger.info('GET /orchestration/workflows');

    const workflows = getAllWorkflows();

    res.json({
      success: true,
      data: {
        workflows,
        count: workflows.length,
      },
    });
  } catch (error: any) {
    logger.error('Error listing workflows', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to list workflows',
    });
  }
});

/**
 * POST /orchestration/execute
 * Execute a predefined workflow
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { workflowName, userId, input } = req.body;

    if (!workflowName || !userId || !input) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'workflowName, userId, and input are required',
      });
    }

    logger.info('POST /orchestration/execute', { workflowName, userId });

    // Get workflow definition
    const workflow = getWorkflow(workflowName);
    if (!workflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Workflow not found: ${workflowName}`,
      });
    }

    // Execute workflow
    const result = await agentOrchestrator.executeWorkflow(workflow, userId, input);

    res.json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error executing workflow', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to execute workflow',
    });
  }
});

/**
 * POST /orchestration/execute-sequential
 * Execute a custom sequential workflow
 */
router.post('/execute-sequential', async (req: Request, res: Response) => {
  try {
    const { userId, tasks } = req.body;

    if (!userId || !tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId and tasks (array) are required',
      });
    }

    logger.info('POST /orchestration/execute-sequential', {
      userId,
      taskCount: tasks.length,
    });

    // Validate tasks
    for (const task of tasks) {
      if (!task.agentType || !task.taskType || !task.input) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Each task must have agentType, taskType, and input',
        });
      }
    }

    // Execute sequential workflow
    const result = await agentOrchestrator.executeSequentialWorkflow(userId, tasks);

    res.json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error executing sequential workflow', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to execute sequential workflow',
    });
  }
});

/**
 * GET /orchestration/agents
 * List all registered agents
 */
router.get('/agents', (req: Request, res: Response) => {
  try {
    logger.info('GET /orchestration/agents');

    const agents = agentRegistry.getAllMetadata();

    res.json({
      success: true,
      data: {
        agents,
        count: agents.length,
      },
    });
  } catch (error: any) {
    logger.error('Error listing agents', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to list agents',
    });
  }
});

/**
 * GET /orchestration/agents/health
 * Check health of all agents
 */
router.get('/agents/health', async (req: Request, res: Response) => {
  try {
    logger.info('GET /orchestration/agents/health');

    const health = await agentRegistry.checkHealth();

    const allHealthy = Object.values(health).every((status) => status === true);

    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      data: {
        status: allHealthy ? 'healthy' : 'degraded',
        agents: health,
      },
    });
  } catch (error: any) {
    logger.error('Error checking agent health', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to check agent health',
    });
  }
});

export default router;
