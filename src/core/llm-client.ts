import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';
import { logger } from '../utils/logger';

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMClientOptions {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

class LLMClient {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    // Initialize OpenAI client if API key is available
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
      logger.info('✅ OpenAI client initialized');
    } else {
      logger.warn('⚠️  OpenAI API key not found - OpenAI features will be unavailable');
    }

    // Initialize Anthropic client if API key is available
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
      logger.info('✅ Anthropic client initialized');
    } else {
      logger.warn('⚠️  Anthropic API key not found - Anthropic features will be unavailable');
    }
  }

  async chat(
    messages: ChatMessage[],
    options: LLMClientOptions = {}
  ): Promise<LLMResponse> {
    const provider = options.provider || LLMProvider.OPENAI;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? 2000;

    try {
      if (provider === LLMProvider.OPENAI) {
        return await this.chatOpenAI(messages, {
          model: options.model || 'gpt-4-turbo-preview',
          temperature,
          maxTokens,
        });
      } else if (provider === LLMProvider.ANTHROPIC) {
        return await this.chatAnthropic(messages, {
          model: options.model || 'claude-3-5-sonnet-20241022',
          temperature,
          maxTokens,
        });
      } else {
        throw new Error(`Unsupported LLM provider: ${provider}`);
      }
    } catch (error) {
      logger.error('LLM chat error', error);
      throw error;
    }
  }

  private async chatOpenAI(
    messages: ChatMessage[],
    options: { model: string; temperature: number; maxTokens: number }
  ): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - check API key configuration');
    }

    logger.debug('OpenAI request', { model: options.model, messageCount: messages.length });

    const completion = await this.openai.chat.completions.create({
      model: options.model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });

    const response: LLMResponse = {
      content: completion.choices[0]?.message?.content || '',
      provider: LLMProvider.OPENAI,
      model: completion.model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
    };

    logger.debug('OpenAI response', {
      model: response.model,
      tokens: response.usage?.totalTokens,
    });

    return response;
  }

  private async chatAnthropic(
    messages: ChatMessage[],
    options: { model: string; temperature: number; maxTokens: number }
  ): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized - check API key configuration');
    }

    logger.debug('Anthropic request', { model: options.model, messageCount: messages.length });

    // Extract system message if present
    const systemMessage = messages.find((msg) => msg.role === 'system');
    const conversationMessages = messages.filter((msg) => msg.role !== 'system');

    const message = await this.anthropic.messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: systemMessage?.content,
      messages: conversationMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    });

    const response: LLMResponse = {
      content: message.content[0].type === 'text' ? message.content[0].text : '',
      provider: LLMProvider.ANTHROPIC,
      model: message.model,
      usage: {
        promptTokens: message.usage.input_tokens,
        completionTokens: message.usage.output_tokens,
        totalTokens: message.usage.input_tokens + message.usage.output_tokens,
      },
    };

    logger.debug('Anthropic response', {
      model: response.model,
      tokens: response.usage?.totalTokens,
    });

    return response;
  }

  // Convenience method to check if a provider is available
  isProviderAvailable(provider: LLMProvider): boolean {
    if (provider === LLMProvider.OPENAI) {
      return this.openai !== null;
    } else if (provider === LLMProvider.ANTHROPIC) {
      return this.anthropic !== null;
    }
    return false;
  }

  // Get list of available providers
  getAvailableProviders(): LLMProvider[] {
    const providers: LLMProvider[] = [];
    if (this.openai) providers.push(LLMProvider.OPENAI);
    if (this.anthropic) providers.push(LLMProvider.ANTHROPIC);
    return providers;
  }
}

// Export singleton instance
export const llmClient = new LLMClient();
