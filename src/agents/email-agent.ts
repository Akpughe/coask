import { llmClient, LLMProvider, ChatMessage } from '../core/llm-client';
import { conversationStore } from '../memory/conversation-store';
import { ragPipeline } from '../rag/custom-rag-pipeline';
import { logger } from '../utils/logger';
import { emailProviderManager } from '../email/email-provider-manager';
import { EmailParams, EmailResult, EmailAttachment } from '../email/email-provider';

export interface EmailDraftRequest {
  userId: string;
  to?: string;
  subject?: string;
  context: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'formal';
  length?: 'short' | 'medium' | 'long';
  useRAG?: boolean;
  ragCategory?: string;
}

export interface EmailDraftResponse {
  draft: string;
  subject: string;
  conversationId: string;
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    usedRAG?: boolean;
    ragSources?: number;
  };
}

export interface EmailReplyRequest {
  userId: string;
  originalEmail: string;
  replyContext: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'formal';
  useRAG?: boolean;
  ragCategory?: string;
}

export interface EmailReplyResponse {
  reply: string;
  conversationId: string;
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    usedRAG?: boolean;
    ragSources?: number;
  };
}

export interface EmailSendRequest {
  userId: string;
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailSendResponse {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Email Agent - Specialized AI agent for email composition and management
 * Phase 1: Basic email drafting and reply functionality
 * Phase 3: RAG integration for knowledge-enhanced emails
 * Phase 5: Multi-provider email sending
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

    logger.info('Email Agent: Drafting email', { userId, tone, length, useRAG: request.useRAG });

    // Get or create conversation for this user
    const conversation = conversationStore.getOrCreateConversation(userId, this.agentType);

    // Add system prompt if this is a new conversation
    if (conversation.messages.length === 0) {
      conversationStore.addMessage(conversation.id, 'system', this.systemPrompt);
    }

    // Optionally retrieve relevant context from RAG
    let ragContext = '';
    let ragSources = 0;
    if (request.useRAG && ragPipeline.isReady()) {
      try {
        logger.debug('Querying knowledge base for email context', { context });
        const ragResult = await ragPipeline.query(context, {
          topK: 3,
          filter: request.ragCategory ? { category: request.ragCategory } : undefined,
          minScore: 0.7,
        });

        if (ragResult.sources.length > 0) {
          ragContext = `\n\nRELEVANT INFORMATION FROM KNOWLEDGE BASE:\n${ragResult.context}\n`;
          ragSources = ragResult.sources.length;
          logger.info('RAG context retrieved', { sources: ragSources });
        }
      } catch (error) {
        logger.warn('Failed to retrieve RAG context', error);
      }
    }

    // Build user prompt
    let userPrompt = `Draft an email with the following details:\n\n`;
    if (to) userPrompt += `To: ${to}\n`;
    if (subject) userPrompt += `Subject: ${subject}\n`;
    userPrompt += `Tone: ${tone}\n`;
    userPrompt += `Length: ${length}\n`;
    userPrompt += `\nContext:\n${context}\n`;
    if (ragContext) userPrompt += ragContext;
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
        usedRAG: request.useRAG && ragSources > 0,
        ragSources: ragSources > 0 ? ragSources : undefined,
      },
    };
  }

  /**
   * Generate a reply to an existing email
   */
  async replyToEmail(request: EmailReplyRequest): Promise<EmailReplyResponse> {
    const { userId, originalEmail, replyContext, tone = 'professional' } = request;

    logger.info('Email Agent: Generating reply', { userId, tone, useRAG: request.useRAG });

    // Get or create conversation for this user
    const conversation = conversationStore.getOrCreateConversation(userId, this.agentType);

    // Add system prompt if this is a new conversation
    if (conversation.messages.length === 0) {
      conversationStore.addMessage(conversation.id, 'system', this.systemPrompt);
    }

    // Optionally retrieve relevant context from RAG
    let ragContext = '';
    let ragSources = 0;
    if (request.useRAG && ragPipeline.isReady()) {
      try {
        logger.debug('Querying knowledge base for reply context', { replyContext });
        const ragResult = await ragPipeline.query(replyContext, {
          topK: 3,
          filter: request.ragCategory ? { category: request.ragCategory } : undefined,
          minScore: 0.7,
        });

        if (ragResult.sources.length > 0) {
          ragContext = `\n\nRELEVANT INFORMATION FROM KNOWLEDGE BASE:\n${ragResult.context}\n`;
          ragSources = ragResult.sources.length;
          logger.info('RAG context retrieved for reply', { sources: ragSources });
        }
      } catch (error) {
        logger.warn('Failed to retrieve RAG context for reply', error);
      }
    }

    // Build user prompt
    let userPrompt = `Generate a reply to the following email:\n\n---
ORIGINAL EMAIL:
${originalEmail}
---

REPLY CONTEXT:
${replyContext}

TONE: ${tone}`;
    if (ragContext) userPrompt += `\n${ragContext}`;
    userPrompt += `\n\nPlease generate an appropriate reply following email best practices.`;

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
        usedRAG: request.useRAG && ragSources > 0,
        ragSources: ragSources > 0 ? ragSources : undefined,
      },
    };
  }

  /**
   * Send an email using the multi-provider email system
   */
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResponse> {
    const { userId, from, to, subject, html, text, cc, bcc, replyTo, attachments } = request;

    logger.info('Email Agent: Sending email', {
      userId,
      from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
    });

    // Validate required fields
    if (!from || !to || !subject) {
      const error = 'Missing required fields: from, to, and subject are required';
      logger.error('Email send validation failed', { error });
      return {
        success: false,
        provider: 'none',
        error,
      };
    }

    if (!html && !text) {
      const error = 'Either html or text content is required';
      logger.error('Email send validation failed', { error });
      return {
        success: false,
        provider: 'none',
        error,
      };
    }

    // Check if any email provider is configured
    if (!emailProviderManager.hasConfiguredProvider()) {
      const error = 'No email provider configured';
      logger.error('Email send failed', { error });
      return {
        success: false,
        provider: 'none',
        error,
      };
    }

    try {
      // Send via email provider manager (handles routing and provider selection)
      const result = await emailProviderManager.send({
        from,
        to,
        subject,
        html,
        text,
        cc,
        bcc,
        replyTo,
        attachments,
      });

      if (result.success) {
        logger.info('Email sent successfully', {
          userId,
          provider: result.provider,
          messageId: result.messageId,
        });
      } else {
        logger.error('Email send failed', {
          userId,
          provider: result.provider,
          error: result.error,
        });
      }

      return {
        success: result.success,
        messageId: result.messageId,
        provider: result.provider,
        error: result.error,
        metadata: result.metadata,
      };
    } catch (error: any) {
      logger.error('Email send exception', error);
      return {
        success: false,
        provider: 'unknown',
        error: error.message || 'Failed to send email',
      };
    }
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
