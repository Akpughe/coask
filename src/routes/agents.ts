import express, { Router, Request, Response } from 'express';
import { emailAgent } from '../agents/email-agent';
import { conversationStore } from '../memory/conversation-store';
import { logger } from '../utils/logger';

const router: Router = express.Router();

/**
 * POST /agents/email/draft
 * Draft a new email
 */
router.post('/email/draft', async (req: Request, res: Response) => {
  try {
    const { userId, to, subject, context, tone, length } = req.body;

    // Validation
    if (!userId || !context) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId and context are required',
      });
    }

    // Validate tone if provided
    const validTones = ['professional', 'casual', 'friendly', 'formal'];
    if (tone && !validTones.includes(tone)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid tone. Must be one of: ${validTones.join(', ')}`,
      });
    }

    // Validate length if provided
    const validLengths = ['short', 'medium', 'long'];
    if (length && !validLengths.includes(length)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid length. Must be one of: ${validLengths.join(', ')}`,
      });
    }

    logger.info('POST /agents/email/draft', { userId, tone, length });

    const result = await emailAgent.draftEmail({
      userId,
      to,
      subject,
      context,
      tone,
      length,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error drafting email', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to draft email',
    });
  }
});

/**
 * POST /agents/email/reply
 * Generate a reply to an email
 */
router.post('/email/reply', async (req: Request, res: Response) => {
  try {
    const { userId, originalEmail, replyContext, tone } = req.body;

    // Validation
    if (!userId || !originalEmail || !replyContext) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId, originalEmail, and replyContext are required',
      });
    }

    // Validate tone if provided
    const validTones = ['professional', 'casual', 'friendly', 'formal'];
    if (tone && !validTones.includes(tone)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid tone. Must be one of: ${validTones.join(', ')}`,
      });
    }

    logger.info('POST /agents/email/reply', { userId, tone });

    const result = await emailAgent.replyToEmail({
      userId,
      originalEmail,
      replyContext,
      tone,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error generating email reply', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to generate reply',
    });
  }
});

/**
 * DELETE /agents/email/history/:userId
 * Clear conversation history for a user
 */
router.delete('/email/history/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required',
      });
    }

    logger.info('DELETE /agents/email/history', { userId });

    emailAgent.clearHistory(userId);

    res.json({
      success: true,
      message: 'Conversation history cleared',
    });
  } catch (error: any) {
    logger.error('Error clearing history', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to clear history',
    });
  }
});

/**
 * GET /agents/email/stats
 * Get Email Agent statistics
 */
router.get('/email/stats', (req: Request, res: Response) => {
  try {
    logger.info('GET /agents/email/stats');

    const stats = emailAgent.getStats();
    const memoryStats = conversationStore.getStats();

    res.json({
      success: true,
      data: {
        agent: stats,
        memory: memoryStats,
      },
    });
  } catch (error: any) {
    logger.error('Error getting stats', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to get stats',
    });
  }
});

/**
 * GET /agents/email/conversations/:userId
 * Get all conversations for a user
 */
router.get('/email/conversations/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required',
      });
    }

    logger.info('GET /agents/email/conversations', { userId });

    const conversations = conversationStore.getUserConversations(userId);

    res.json({
      success: true,
      data: {
        userId,
        conversations: conversations.map((conv) => ({
          id: conv.id,
          agentType: conv.agentType,
          messageCount: conv.messages.length,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        })),
      },
    });
  } catch (error: any) {
    logger.error('Error getting conversations', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to get conversations',
    });
  }
});

export default router;
