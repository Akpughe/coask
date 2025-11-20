import { BaseAgent, AgentCapability, AgentTask, AgentContext } from './base-agent';
import { llmClient, LLMProvider } from '../core/llm-client';
import { ragPipeline } from '../rag/custom-rag-pipeline';
import { logger } from '../utils/logger';
import { config } from '../core/config';
import Exa from 'exa-js';

/**
 * Research task types
 */
export enum ResearchTaskType {
  WEB_SEARCH = 'research.web_search',
  SUMMARIZE = 'research.summarize',
  EXTRACT_INFO = 'research.extract_info',
  ANALYZE = 'research.analyze',
}

/**
 * Web search request
 */
export interface WebSearchRequest {
  query: string;
  numResults?: number;
  userId: string;
  saveToKnowledgeBase?: boolean;
  category?: string;
}

/**
 * Summarize request
 */
export interface SummarizeRequest {
  text: string;
  userId: string;
  maxLength?: 'short' | 'medium' | 'long';
}

/**
 * Extract info request
 */
export interface ExtractInfoRequest {
  text: string;
  userId: string;
  extractType: 'entities' | 'keywords' | 'facts' | 'dates';
}

/**
 * Analyze request
 */
export interface AnalyzeRequest {
  text: string;
  userId: string;
  analysisType: 'sentiment' | 'topics' | 'insights';
}

/**
 * Research Agent
 * Performs web research, summarization, information extraction, and analysis
 */
export class ResearchAgent extends BaseAgent {
  private readonly systemPrompt = `You are an expert research assistant. Your role is to:

1. Conduct thorough web research and gather accurate information
2. Summarize complex information clearly and concisely
3. Extract key entities, facts, and insights from text
4. Analyze content for sentiment, topics, and patterns
5. Provide well-structured, actionable insights

Always cite sources when researching and be objective in your analysis.`;

  private exaClient: Exa | null = null;

  constructor() {
    super('Research Agent', 'research', 'AI agent for research, summarization, and analysis');
    this.agentVersion = '1.0.0';

    // Initialize Exa client if API key is available
    if (config.exaApiKey) {
      this.exaClient = new Exa(config.exaApiKey);
      logger.info('✅ Exa client initialized for Research Agent');
    } else {
      logger.warn('⚠️  Exa API key not found - web search will use fallback mode');
    }
  }

  protected getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'web_search',
        description: 'Search the web and synthesize information',
        parameters: {
          query: 'string',
          numResults: 'number (optional)',
          saveToKnowledgeBase: 'boolean (optional)',
        },
      },
      {
        name: 'summarize',
        description: 'Summarize long-form text',
        parameters: {
          text: 'string',
          maxLength: 'short | medium | long (optional)',
        },
      },
      {
        name: 'extract_info',
        description: 'Extract entities, keywords, facts, or dates from text',
        parameters: {
          text: 'string',
          extractType: 'entities | keywords | facts | dates',
        },
      },
      {
        name: 'analyze',
        description: 'Analyze text for sentiment, topics, or insights',
        parameters: {
          text: 'string',
          analysisType: 'sentiment | topics | insights',
        },
      },
    ];
  }

  protected getSupportedTaskTypes(): string[] {
    return [
      ResearchTaskType.WEB_SEARCH,
      ResearchTaskType.SUMMARIZE,
      ResearchTaskType.EXTRACT_INFO,
      ResearchTaskType.ANALYZE,
    ];
  }

  protected async executeTask(task: AgentTask): Promise<any> {
    switch (task.type) {
      case ResearchTaskType.WEB_SEARCH:
        return await this.webSearch(task.input, task.context);
      case ResearchTaskType.SUMMARIZE:
        return await this.summarize(task.input, task.context);
      case ResearchTaskType.EXTRACT_INFO:
        return await this.extractInfo(task.input, task.context);
      case ResearchTaskType.ANALYZE:
        return await this.analyze(task.input, task.context);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Perform web search using Exa API
   */
  private async webSearch(
    request: WebSearchRequest,
    context: AgentContext
  ): Promise<{
    query: string;
    results: Array<{ title: string; snippet: string; source: string; publishedDate?: string }>;
    synthesis: string;
    savedToKnowledgeBase?: boolean;
    searchProvider: 'exa' | 'fallback';
  }> {
    logger.info('Research Agent: Web search', { query: request.query });

    const numResults = request.numResults || 5;
    let results: Array<{ title: string; snippet: string; source: string; publishedDate?: string }> = [];
    let searchProvider: 'exa' | 'fallback' = 'fallback';

    // Try Exa search if client is available
    if (this.exaClient) {
      try {
        logger.info('Using Exa for web search', { query: request.query, numResults });

        const searchResponse = await this.exaClient.searchAndContents(request.query, {
          numResults,
          text: { maxCharacters: 1000 }, // Get text snippets
          highlights: true,
        });

        results = searchResponse.results.map((result: any) => ({
          title: result.title || 'Untitled',
          snippet: result.text || result.highlights?.[0] || 'No snippet available',
          source: result.url,
          publishedDate: result.publishedDate,
        }));

        searchProvider = 'exa';
        logger.info('Exa search completed', { resultsCount: results.length });
      } catch (error: any) {
        logger.error('Exa search failed, falling back to mock data', error);
        searchProvider = 'fallback';
        results = this.getMockResults(request.query);
      }
    } else {
      // Fallback to mock results if Exa is not available
      logger.info('Exa not available, using fallback search');
      results = this.getMockResults(request.query);
    }

    // Synthesize results using LLM
    const synthesisPrompt = `Based on the following search results for "${request.query}", provide a comprehensive summary:

${results.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\nSource: ${r.source}${r.publishedDate ? `\nPublished: ${r.publishedDate}` : ''}`).join('\n\n')}

Provide a well-structured summary with key points and insights. Include the most important facts and cite sources.`;

    const synthesis = await llmClient.chat(
      [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: synthesisPrompt },
      ],
      {
        provider: LLMProvider.OPENAI,
        temperature: 0.7,
        maxTokens: 1000,
      }
    );

    // Optionally save to knowledge base
    let savedToKnowledgeBase = false;
    if (request.saveToKnowledgeBase && ragPipeline.isReady()) {
      try {
        await ragPipeline.ingestFromText(synthesis.content, {
          source: `web_search:${request.query}`,
          category: request.category || 'research',
          metadata: {
            query: request.query,
            searchDate: new Date().toISOString(),
            userId: request.userId,
            searchProvider,
            numResults: results.length,
          },
        });
        savedToKnowledgeBase = true;
        logger.info('Research saved to knowledge base', { query: request.query });
      } catch (error) {
        logger.warn('Failed to save research to knowledge base', error);
      }
    }

    return {
      query: request.query,
      results,
      synthesis: synthesis.content,
      savedToKnowledgeBase,
      searchProvider,
    };
  }

  /**
   * Get mock search results (fallback when Exa is not available)
   */
  private getMockResults(query: string): Array<{ title: string; snippet: string; source: string }> {
    return [
      {
        title: `Understanding ${query}`,
        snippet: `${query} is an important topic with significant implications. Current research suggests various approaches and methodologies for understanding this subject in depth.`,
        source: 'https://example.com/article1',
      },
      {
        title: `The Complete Guide to ${query}`,
        snippet: `Learn everything about ${query} including best practices, common pitfalls, and expert recommendations for implementation and analysis.`,
        source: 'https://example.com/article2',
      },
      {
        title: `${query}: Latest Trends and Insights`,
        snippet: `Recent developments in ${query} show promising results. Industry experts highlight key factors and emerging patterns worth noting.`,
        source: 'https://example.com/article3',
      },
    ];
  }

  /**
   * Summarize text
   */
  private async summarize(
    request: SummarizeRequest,
    context: AgentContext
  ): Promise<{ summary: string; originalLength: number; summaryLength: number }> {
    logger.info('Research Agent: Summarize', {
      textLength: request.text.length,
      maxLength: request.maxLength,
    });

    const maxTokens = this.getMaxTokensForLength(request.maxLength || 'medium');

    const summaryPrompt = `Summarize the following text concisely and clearly, capturing all key points:

${request.text}

Provide a ${request.maxLength || 'medium'}-length summary.`;

    const response = await llmClient.chat(
      [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: summaryPrompt },
      ],
      {
        provider: LLMProvider.OPENAI,
        temperature: 0.5,
        maxTokens,
      }
    );

    return {
      summary: response.content,
      originalLength: request.text.length,
      summaryLength: response.content.length,
    };
  }

  /**
   * Extract information from text
   */
  private async extractInfo(
    request: ExtractInfoRequest,
    context: AgentContext
  ): Promise<{ extractType: string; extracted: string[] | Record<string, any> }> {
    logger.info('Research Agent: Extract info', { extractType: request.extractType });

    let extractPrompt = '';

    switch (request.extractType) {
      case 'entities':
        extractPrompt = `Extract all named entities (people, organizations, locations) from the following text. Return as a JSON array:

${request.text}

Format: ["entity1", "entity2", ...]`;
        break;
      case 'keywords':
        extractPrompt = `Extract the most important keywords and phrases from the following text. Return as a JSON array:

${request.text}

Format: ["keyword1", "keyword2", ...]`;
        break;
      case 'facts':
        extractPrompt = `Extract all factual statements from the following text. Return as a JSON array:

${request.text}

Format: ["fact1", "fact2", ...]`;
        break;
      case 'dates':
        extractPrompt = `Extract all dates and time references from the following text. Return as a JSON array with context:

${request.text}

Format: [{"date": "2024-01-01", "context": "..."}, ...]`;
        break;
      default:
        throw new Error(`Unknown extract type: ${request.extractType}`);
    }

    const response = await llmClient.chat(
      [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: extractPrompt },
      ],
      {
        provider: LLMProvider.OPENAI,
        temperature: 0.3,
        maxTokens: 1500,
      }
    );

    // Try to parse JSON response
    let extracted: string[] | Record<string, any>;
    try {
      extracted = JSON.parse(response.content);
    } catch {
      // If not valid JSON, return as array with single item
      extracted = [response.content];
    }

    return {
      extractType: request.extractType,
      extracted,
    };
  }

  /**
   * Analyze text
   */
  private async analyze(
    request: AnalyzeRequest,
    context: AgentContext
  ): Promise<{ analysisType: string; analysis: any }> {
    logger.info('Research Agent: Analyze', { analysisType: request.analysisType });

    let analysisPrompt = '';

    switch (request.analysisType) {
      case 'sentiment':
        analysisPrompt = `Analyze the sentiment of the following text. Provide:
1. Overall sentiment (positive/negative/neutral)
2. Sentiment score (-1 to 1)
3. Key emotional indicators
Return as JSON:

${request.text}

Format: {"overall": "positive", "score": 0.8, "indicators": [...]}`;
        break;
      case 'topics':
        analysisPrompt = `Identify the main topics and themes in the following text. Return as JSON:

${request.text}

Format: {"main_topics": [...], "subtopics": [...]}`;
        break;
      case 'insights':
        analysisPrompt = `Analyze the following text and provide key insights, patterns, and takeaways. Return as JSON:

${request.text}

Format: {"key_insights": [...], "patterns": [...], "recommendations": [...]}`;
        break;
      default:
        throw new Error(`Unknown analysis type: ${request.analysisType}`);
    }

    const response = await llmClient.chat(
      [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: analysisPrompt },
      ],
      {
        provider: LLMProvider.OPENAI,
        temperature: 0.5,
        maxTokens: 1500,
      }
    );

    // Try to parse JSON response
    let analysis: any;
    try {
      analysis = JSON.parse(response.content);
    } catch {
      analysis = { result: response.content };
    }

    return {
      analysisType: request.analysisType,
      analysis,
    };
  }

  /**
   * Get max tokens based on length
   */
  private getMaxTokensForLength(length: 'short' | 'medium' | 'long'): number {
    switch (length) {
      case 'short':
        return 300;
      case 'medium':
        return 600;
      case 'long':
        return 1200;
      default:
        return 600;
    }
  }

  protected getExecutionMetadata(task: AgentTask, output: any): Record<string, any> {
    const metadata: Record<string, any> = {
      taskType: task.type,
    };

    if (task.type === ResearchTaskType.WEB_SEARCH && output.savedToKnowledgeBase) {
      metadata.savedToKnowledgeBase = true;
    }

    return metadata;
  }

  async isHealthy(): Promise<boolean> {
    return llmClient.isProviderAvailable(LLMProvider.OPENAI);
  }
}

// Export singleton instance
export const researchAgent = new ResearchAgent();
