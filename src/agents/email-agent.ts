import { llmClient, LLMProvider, ChatMessage } from '../core/llm-client';
import { conversationStore } from '../memory/conversation-store';
import { logger } from '../utils/logger';

export interface EmailDraftRequest {
  userId: string;
  to?: string;
  subject?: string;
  context: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'formal';
  length?: 'short' | 'medium' | 'long';
}

export interface EmailDraftResponse {
  draft: string;
  subject: string;
  conversationId: string;
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
  };
}

export interface EmailReplyRequest {
  userId: string;
  originalEmail: string;
  replyContext: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'formal';
}

export interface EmailReplyResponse {
  reply: string;
  conversationId: string;
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
  };
}

/**
 * Email Agent - Specialized AI agent for email composition and management
 * Phase 1: Basic email drafting and reply functionality
 * Future phases: Email classification, scheduling, follow-ups
 */
class EmailAgent {
  private readonly agentType = 'email';
  private readonly systemPrompt = `You are an expert email composition assistant. Your role is to:

1. Draft professional, clear, and effective emails based on user instructions
2. Match the requested tone and length
3. Use proper email etiquette and formatting
4. Be concise and action-oriented
5. Include appropriate greetings and sign-offs

When drafting emails:
- Start with an appropriate greeting
- Get to the point quickly
- Use clear, simple language
- Include a clear call-to-action when needed
- End with a professional sign-off

Format your response as:
SUBJECT: [Email subject line]
---
[Email body]`;

  constructor() {
    logger.info('✅ Email Agent initialized');
  }

  /**
   * Draft a new email based on user context
   */
  async draftEmail(request: EmailDraftRequest): Promise<EmailDraftResponse> {
    const {
      userId,
      to,
      subject,
      context,
      tone = 'professional',
      length = 'medium',
    } = request;

    logger.info('Email Agent: Drafting email', { userId, tone, length });

    // Get or create conversation for this user
    const conversation = conversationStore.getOrCreateConversation(userId, this.agentType);

    // Add system prompt if this is a new conversation
    if (conversation.messages.length === 0) {
      conversationStore.addMessage(conversation.id, 'system', this.systemPrompt);
    }

    // Build user prompt
    let userPrompt = `Draft an email with the following details:\n\n`;
    if (to) userPrompt += `To: ${to}\n`;
    if (subject) userPrompt += `Subject: ${subject}\n`;
    userPrompt += `Tone: ${tone}\n`;
    userPrompt += `Length: ${length}\n`;
    userPrompt += `\nContext:\n${context}\n`;
    userPrompt += `\nPlease draft the email following the format specified.`;

    // Add user message to conversation
    conversationStore.addMessage(conversation.id, 'user', userPrompt);

    // Get all messages for LLM context
    const messages = conversationStore.getMessages(conversation.id);

    // Call LLM
    const response = await llmClient.chat(
      messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        provider: LLMProvider.OPENAI,
        temperature: 0.7,
        maxTokens: this.getMaxTokensForLength(length),
      }
    );

    // Add assistant response to conversation
    conversationStore.addMessage(conversation.id, 'assistant', response.content);

    // Parse the response to extract subject and body
    const { subject: extractedSubject, body } = this.parseEmailDraft(response.content);

    logger.info('Email Agent: Draft completed', {
      userId,
      tokensUsed: response.usage?.totalTokens,
    });

    return {
      draft: body,
      subject: extractedSubject || subject || 'No Subject',
      conversationId: conversation.id,
      metadata: {
        provider: response.provider,
        model: response.model,
        tokensUsed: response.usage?.totalTokens || 0,
      },
    };
  }

  /**
   * Generate a reply to an existing email
   */
  async replyToEmail(request: EmailReplyRequest): Promise<EmailReplyResponse> {
    const { userId, originalEmail, replyContext, tone = 'professional' } = request;

    logger.info('Email Agent: Generating reply', { userId, tone });

    // Get or create conversation for this user
    const conversation = conversationStore.getOrCreateConversation(userId, this.agentType);

    // Add system prompt if this is a new conversation
    if (conversation.messages.length === 0) {
      conversationStore.addMessage(conversation.id, 'system', this.systemPrompt);
    }

    // Build user prompt
    const userPrompt = `Generate a reply to the following email:\n\n---
ORIGINAL EMAIL:
${originalEmail}
---

REPLY CONTEXT:
${replyContext}

TONE: ${tone}

Please generate an appropriate reply following email best practices.`;

    // Add user message to conversation
    conversationStore.addMessage(conversation.id, 'user', userPrompt);

    // Get all messages for LLM context
    const messages = conversationStore.getMessages(conversation.id);

    // Call LLM
    const response = await llmClient.chat(
      messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        provider: LLMProvider.OPENAI,
        temperature: 0.7,
        maxTokens: 1500,
      }
    );

    // Add assistant response to conversation
    conversationStore.addMessage(conversation.id, 'assistant', response.content);

    // Parse the response (it might include SUBJECT: or just be the body)
    const { body } = this.parseEmailDraft(response.content);

    logger.info('Email Agent: Reply completed', {
      userId,
      tokensUsed: response.usage?.totalTokens,
    });

    return {
      reply: body,
      conversationId: conversation.id,
      metadata: {
        provider: response.provider,
        model: response.model,
        tokensUsed: response.usage?.totalTokens || 0,
      },
    };
  }

  /**
   * Clear conversation history for a user
   */
  clearHistory(userId: string): void {
    const conversationId = `${userId}:${this.agentType}`;
    conversationStore.clearConversation(conversationId);
    logger.info('Email Agent: Cleared conversation history', { userId });
  }

  /**
   * Parse email draft from LLM response
   */
  private parseEmailDraft(content: string): { subject: string | null; body: string } {
    // Try to extract subject line
    const subjectMatch = content.match(/SUBJECT:\s*(.+?)(?:\n|---)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : null;

    // Extract body (everything after the subject and separator)
    let body = content;
    if (subject) {
      const bodyStart = content.indexOf('---');
      if (bodyStart !== -1) {
        body = content.substring(bodyStart + 3).trim();
      } else {
        // If no separator, take everything after the subject line
        body = content.substring(content.indexOf('\n', content.indexOf('SUBJECT:')) + 1).trim();
      }
    }

    return { subject, body };
  }

  /**
   * Get max tokens based on requested length
   */
  private getMaxTokensForLength(length: 'short' | 'medium' | 'long'): number {
    switch (length) {
      case 'short':
        return 500;
      case 'medium':
        return 1000;
      case 'long':
        return 2000;
      default:
        return 1000;
    }
  }

  /**
   * Get agent statistics
   */
  getStats() {
    const stats = conversationStore.getStats();
    return {
      totalConversations: stats.conversationsByAgent[this.agentType] || 0,
      agentType: this.agentType,
    };
  }
}

// Export singleton instance
export const emailAgent = new EmailAgent();
