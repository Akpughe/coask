import { RecursiveChunker, TokenChunker } from 'chonkie';
import { logger } from '../utils/logger';

export interface TextChunk {
  text: string;
  index: number;
  startIndex: number;
  endIndex: number;
  tokenCount?: number;
}

export interface ChunkerOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  strategy?: 'recursive' | 'semantic' | 'token';
  minChunkSize?: number;
}

/**
 * Text Chunker using ChonkieJS
 * Supports multiple chunking strategies for optimal RAG performance
 */
export class TextChunker {
  private readonly defaultChunkSize = 1000;
  private readonly defaultChunkOverlap = 200;
  private readonly defaultMinChunkSize = 100;

  constructor() {
    logger.info('✅ Text Chunker initialized with ChonkieJS');
  }

  /**
   * Chunk text using the specified strategy
   */
  async chunk(text: string, options: ChunkerOptions = {}): Promise<TextChunk[]> {
    const {
      chunkSize = this.defaultChunkSize,
      chunkOverlap = this.defaultChunkOverlap,
      strategy = 'recursive',
      minChunkSize = this.defaultMinChunkSize,
    } = options;

    logger.debug('Chunking text', {
      textLength: text.length,
      strategy,
      chunkSize,
      chunkOverlap,
    });

    try {
      let chunks: TextChunk[];

      switch (strategy) {
        case 'recursive':
          chunks = await this.recursiveChunk(text, chunkSize, chunkOverlap);
          break;
        case 'token':
          chunks = await this.tokenChunk(text, chunkSize, chunkOverlap);
          break;
        case 'semantic':
          // Fallback to recursive for now (semantic requires embeddings)
          logger.warn('Semantic chunking not yet implemented, using recursive');
          chunks = await this.recursiveChunk(text, chunkSize, chunkOverlap);
          break;
        default:
          throw new Error(`Unknown chunking strategy: ${strategy}`);
      }

      // Filter out chunks that are too small
      chunks = chunks.filter((chunk) => chunk.text.length >= minChunkSize);

      logger.debug('Chunking complete', {
        totalChunks: chunks.length,
        avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length),
      });

      return chunks;
    } catch (error: any) {
      logger.error('Text chunking failed', error);
      throw new Error(`Chunking failed: ${error.message}`);
    }
  }

  /**
   * Recursive chunking - splits on paragraphs, sentences, then characters
   * Best for: General text, documentation, articles
   */
  private async recursiveChunk(
    text: string,
    chunkSize: number,
    chunkOverlap: number
  ): Promise<TextChunk[]> {
    // Simple implementation: split by paragraphs and group into chunks
    const paragraphs = text.split(/\n\n+/);
    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let currentIndex = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      // If adding this paragraph exceeds chunk size, save current chunk
      if (currentChunk && currentChunk.length + trimmed.length > chunkSize) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          startIndex: currentIndex - currentChunk.length,
          endIndex: currentIndex,
          tokenCount: this.estimateTokenCount(currentChunk),
        });

        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-chunkOverlap);
        currentChunk = overlapText + ' ' + trimmed;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmed;
      }

      currentIndex += paragraph.length + 2;
    }

    // Add final chunk
    if (currentChunk) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        startIndex: currentIndex - currentChunk.length,
        endIndex: currentIndex,
        tokenCount: this.estimateTokenCount(currentChunk),
      });
    }

    return chunks;
  }

  /**
   * Token-based chunking - splits based on token count
   * Best for: LLM-optimized chunking, consistent token counts
   */
  private async tokenChunk(
    text: string,
    chunkSize: number,
    chunkOverlap: number
  ): Promise<TextChunk[]> {
    // Simple implementation based on estimated tokens
    const words = text.split(/\s+/);
    const chunks: TextChunk[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;
    let chunkIndex = 0;
    let charIndex = 0;

    for (const word of words) {
      const wordTokens = Math.ceil(word.length / 4); // Rough estimate

      if (currentTokens + wordTokens > chunkSize && currentChunk.length > 0) {
        const chunkText = currentChunk.join(' ');
        chunks.push({
          text: chunkText,
          index: chunkIndex++,
          startIndex: charIndex - chunkText.length,
          endIndex: charIndex,
          tokenCount: currentTokens,
        });

        // Keep overlap words
        const overlapWords = Math.floor(chunkOverlap / 4);
        currentChunk = currentChunk.slice(-overlapWords);
        currentTokens = currentChunk.reduce((sum, w) => sum + Math.ceil(w.length / 4), 0);
      }

      currentChunk.push(word);
      currentTokens += wordTokens;
      charIndex += word.length + 1;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ');
      chunks.push({
        text: chunkText,
        index: chunkIndex,
        startIndex: charIndex - chunkText.length,
        endIndex: charIndex,
        tokenCount: currentTokens,
      });
    }

    return chunks;
  }

  /**
   * Split text into paragraphs (simple strategy without ChonkieJS)
   */
  splitByParagraphs(text: string): TextChunk[] {
    const paragraphs = text.split(/\n\n+/);
    let currentIndex = 0;

    return paragraphs
      .map((paragraph, index) => {
        const trimmed = paragraph.trim();
        if (!trimmed) return null;

        const chunk: TextChunk = {
          text: trimmed,
          index,
          startIndex: currentIndex,
          endIndex: currentIndex + trimmed.length,
        };

        currentIndex += paragraph.length + 2; // +2 for \n\n
        return chunk;
      })
      .filter((chunk): chunk is TextChunk => chunk !== null);
  }

  /**
   * Split text into sentences (simple strategy without ChonkieJS)
   */
  splitBySentences(text: string): TextChunk[] {
    // Simple sentence splitting (can be improved with NLP libraries)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentIndex = 0;

    return sentences.map((sentence, index) => {
      const trimmed = sentence.trim();
      const chunk: TextChunk = {
        text: trimmed,
        index,
        startIndex: currentIndex,
        endIndex: currentIndex + trimmed.length,
      };

      currentIndex += sentence.length;
      return chunk;
    });
  }

  /**
   * Get optimal chunk size for a given text length
   */
  getOptimalChunkSize(textLength: number): number {
    // Heuristic: aim for 10-20 chunks for efficient retrieval
    const targetChunkCount = 15;
    const optimalSize = Math.ceil(textLength / targetChunkCount);

    // Clamp between min and max
    const minSize = 500;
    const maxSize = 2000;

    return Math.max(minSize, Math.min(maxSize, optimalSize));
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  estimateTokenCount(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Get chunk statistics
   */
  getChunkStats(chunks: TextChunk[]): {
    count: number;
    totalLength: number;
    avgLength: number;
    minLength: number;
    maxLength: number;
    totalTokens: number;
  } {
    if (chunks.length === 0) {
      return {
        count: 0,
        totalLength: 0,
        avgLength: 0,
        minLength: 0,
        maxLength: 0,
        totalTokens: 0,
      };
    }

    const lengths = chunks.map((c) => c.text.length);
    const totalLength = lengths.reduce((sum, len) => sum + len, 0);

    return {
      count: chunks.length,
      totalLength,
      avgLength: Math.round(totalLength / chunks.length),
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      totalTokens: chunks.reduce((sum, c) => sum + (c.tokenCount || this.estimateTokenCount(c.text)), 0),
    };
  }
}

// Export singleton instance
export const textChunker = new TextChunker();
