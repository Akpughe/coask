import { logger } from '../utils/logger';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  agentType: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * In-memory conversation store for Phase 1
 * Will be replaced with Redis/Database in Phase 4
 */
class ConversationStore {
  private conversations: Map<string, Conversation> = new Map();
  private maxMessagesPerConversation = 50; // Prevent memory overflow

  constructor() {
    logger.info('✅ Conversation store initialized (in-memory)');
  }

  /**
   * Create a new conversation
   */
  createConversation(userId: string, agentType: string, metadata?: Record<string, any>): Conversation {
    const conversationId = this.generateConversationId(userId, agentType);

    const conversation: Conversation = {
      id: conversationId,
      userId,
      agentType,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    this.conversations.set(conversationId, conversation);
    logger.debug('Created conversation', { conversationId, userId, agentType });

    return conversation;
  }

  /**
   * Get or create a conversation
   */
  getOrCreateConversation(
    userId: string,
    agentType: string,
    metadata?: Record<string, any>
  ): Conversation {
    const conversationId = this.generateConversationId(userId, agentType);

    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      conversation = this.createConversation(userId, agentType, metadata);
    }

    return conversation;
  }

  /**
   * Add a message to a conversation
   */
  addMessage(
    conversationId: string,
    role: 'system' | 'user' | 'assistant',
    content: string
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const message: Message = {
      role,
      content,
      timestamp: new Date(),
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();

    // Trim old messages if exceeding max limit (keep system messages)
    if (conversation.messages.length > this.maxMessagesPerConversation) {
      const systemMessages = conversation.messages.filter((msg) => msg.role === 'system');
      const recentMessages = conversation.messages
        .filter((msg) => msg.role !== 'system')
        .slice(-this.maxMessagesPerConversation + systemMessages.length);

      conversation.messages = [...systemMessages, ...recentMessages];
      logger.debug('Trimmed conversation history', { conversationId });
    }

    logger.debug('Added message to conversation', {
      conversationId,
      role,
      messageCount: conversation.messages.length,
    });
  }

  /**
   * Get conversation history
   */
  getMessages(conversationId: string): Message[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    return conversation.messages;
  }

  /**
   * Get conversation by ID
   */
  getConversation(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Get all conversations for a user
   */
  getUserConversations(userId: string): Conversation[] {
    return Array.from(this.conversations.values()).filter(
      (conv) => conv.userId === userId
    );
  }

  /**
   * Clear a conversation's history (except system messages)
   */
  clearConversation(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Keep only system messages
    conversation.messages = conversation.messages.filter((msg) => msg.role === 'system');
    conversation.updatedAt = new Date();

    logger.debug('Cleared conversation', { conversationId });
  }

  /**
   * Delete a conversation
   */
  deleteConversation(conversationId: string): void {
    const deleted = this.conversations.delete(conversationId);
    if (deleted) {
      logger.debug('Deleted conversation', { conversationId });
    }
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    totalConversations: number;
    totalMessages: number;
    conversationsByAgent: Record<string, number>;
  } {
    const conversations = Array.from(this.conversations.values());

    const conversationsByAgent: Record<string, number> = {};
    let totalMessages = 0;

    conversations.forEach((conv) => {
      conversationsByAgent[conv.agentType] = (conversationsByAgent[conv.agentType] || 0) + 1;
      totalMessages += conv.messages.length;
    });

    return {
      totalConversations: conversations.length,
      totalMessages,
      conversationsByAgent,
    };
  }

  /**
   * Generate a conversation ID based on userId and agentType
   */
  private generateConversationId(userId: string, agentType: string): string {
    return `${userId}:${agentType}`;
  }

  /**
   * Clear all conversations (useful for testing)
   */
  clearAll(): void {
    this.conversations.clear();
    logger.debug('Cleared all conversations');
  }
}

// Export singleton instance
export const conversationStore = new ConversationStore();
