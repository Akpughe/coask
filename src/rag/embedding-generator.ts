import OpenAI from 'openai';
import { config } from '../core/config';
import { logger } from '../utils/logger';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  tokensUsed: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
  totalTokensUsed: number;
}

/**
 * Embedding Generator using OpenAI's text-embedding-ada-002
 * Generates high-quality embeddings for semantic search
 */
export class EmbeddingGenerator {
  private readonly openai: OpenAI | null = null;
  private readonly model = 'text-embedding-ada-002';
  private readonly dimensions = 1536; // Ada-002 embedding dimensions
  private readonly maxBatchSize = 2048; // OpenAI's batch limit
  private readonly maxTokensPerInput = 8191; // Ada-002 token limit

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
      logger.info('✅ Embedding Generator initialized with OpenAI', { model: this.model });
    } else {
      logger.warn('⚠️  OpenAI API key not found - embedding generation will be unavailable');
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - check API key configuration');
    }

    // Truncate if text is too long
    const truncatedText = this.truncateText(text, this.maxTokensPerInput);

    logger.debug('Generating embedding', {
      textLength: text.length,
      truncated: truncatedText.length !== text.length,
    });

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: truncatedText,
        encoding_format: 'float',
      });

      const embedding = response.data[0].embedding;
      const tokensUsed = response.usage.total_tokens;

      logger.debug('Embedding generated', {
        dimensions: embedding.length,
        tokensUsed,
      });

      return {
        embedding,
        model: this.model,
        dimensions: embedding.length,
        tokensUsed,
      };
    } catch (error: any) {
      logger.error('Embedding generation failed', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * Automatically handles batching if input exceeds OpenAI's limits
   */
  async generateEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - check API key configuration');
    }

    if (texts.length === 0) {
      return {
        embeddings: [],
        model: this.model,
        dimensions: this.dimensions,
        totalTokensUsed: 0,
      };
    }

    logger.debug('Generating batch embeddings', { count: texts.length });

    // Truncate all texts
    const truncatedTexts = texts.map((text) => this.truncateText(text, this.maxTokensPerInput));

    // Split into batches if necessary
    const batches = this.createBatches(truncatedTexts, this.maxBatchSize);
    const allEmbeddings: number[][] = [];
    let totalTokensUsed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      logger.debug(`Processing batch ${i + 1}/${batches.length}`, { batchSize: batch.length });

      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: batch,
          encoding_format: 'float',
        });

        const batchEmbeddings = response.data.map((item) => item.embedding);
        allEmbeddings.push(...batchEmbeddings);
        totalTokensUsed += response.usage.total_tokens;

        logger.debug(`Batch ${i + 1} complete`, {
          embeddings: batchEmbeddings.length,
          tokensUsed: response.usage.total_tokens,
        });
      } catch (error: any) {
        logger.error(`Batch ${i + 1} failed`, error);
        throw new Error(`Failed to generate embeddings for batch ${i + 1}: ${error.message}`);
      }
    }

    logger.info('Batch embedding complete', {
      totalEmbeddings: allEmbeddings.length,
      totalTokensUsed,
      batches: batches.length,
    });

    return {
      embeddings: allEmbeddings,
      model: this.model,
      dimensions: this.dimensions,
      totalTokensUsed,
    };
  }

  /**
   * Calculate cosine similarity between two embeddings
   * Returns a value between -1 and 1 (higher is more similar)
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Find most similar embeddings to a query embedding
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: number[][],
    topK: number = 5
  ): Array<{ index: number; similarity: number }> {
    const similarities = candidateEmbeddings.map((embedding, index) => ({
      index,
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
    }));

    // Sort by similarity (descending) and take top K
    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  /**
   * Truncate text to fit within token limit
   * Simple character-based truncation (rough approximation)
   */
  private truncateText(text: string, maxTokens: number): string {
    // Rough estimate: 1 token ≈ 4 characters for English text
    const maxChars = maxTokens * 4;

    if (text.length <= maxChars) {
      return text;
    }

    logger.warn('Text truncated to fit token limit', {
      originalLength: text.length,
      truncatedLength: maxChars,
      maxTokens,
    });

    return text.substring(0, maxChars);
  }

  /**
   * Split array into batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Estimate cost for generating embeddings
   * OpenAI pricing: $0.0001 per 1K tokens
   */
  estimateCost(tokenCount: number): number {
    const costPer1KTokens = 0.0001;
    return (tokenCount / 1000) * costPer1KTokens;
  }

  /**
   * Get embedding model information
   */
  getModelInfo(): {
    model: string;
    dimensions: number;
    maxTokens: number;
    maxBatchSize: number;
    costPer1KTokens: number;
  } {
    return {
      model: this.model,
      dimensions: this.dimensions,
      maxTokens: this.maxTokensPerInput,
      maxBatchSize: this.maxBatchSize,
      costPer1KTokens: 0.0001,
    };
  }

  /**
   * Check if embedding generator is available
   */
  isAvailable(): boolean {
    return this.openai !== null;
  }
}

// Export singleton instance
export const embeddingGenerator = new EmbeddingGenerator();
