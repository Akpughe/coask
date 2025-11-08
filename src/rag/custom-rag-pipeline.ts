import { documentExtractor, ExtractedDocument } from './document-extractor';
import { textChunker, TextChunk, ChunkerOptions } from './text-chunker';
import { embeddingGenerator } from './embedding-generator';
import { vectorStore, VectorRecord, QueryResult } from './vector-store';
import { logger } from '../utils/logger';

export interface IngestDocumentOptions {
  source: string;
  category?: string;
  metadata?: Record<string, any>;
  chunkerOptions?: ChunkerOptions;
}

export interface IngestResult {
  docId: string;
  chunksIngested: number;
  totalTokensUsed: number;
  metadata: {
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    category?: string;
    source: string;
    ingestedAt: Date;
  };
}

export interface QueryOptions {
  topK?: number;
  filter?: Record<string, any>;
  includeScores?: boolean;
  minScore?: number;
}

export interface RetrievalResult {
  context: string;
  sources: Array<{
    docId: string;
    chunkIndex: number;
    score: number;
    text: string;
    metadata?: Record<string, any>;
  }>;
  tokensUsed: number;
}

/**
 * Custom RAG Pipeline
 * Orchestrates document ingestion and retrieval using:
 * - Mistral OCR for document extraction
 * - ChonkieJS for text chunking
 * - OpenAI for embeddings
 * - Pinecone for vector storage and hybrid search
 */
export class CustomRAGPipeline {
  constructor() {
    logger.info('✅ Custom RAG Pipeline initialized');
  }

  /**
   * Ingest a document from file path
   */
  async ingestFromFile(filePath: string, options: IngestDocumentOptions): Promise<IngestResult> {
    logger.info('Ingesting document from file', { filePath, category: options.category });

    // Step 1: Extract text from document
    const extracted = await documentExtractor.extractFromFile(filePath);

    // Step 2: Process and store
    return await this.processAndStore(extracted, options);
  }

  /**
   * Ingest a document from URL
   */
  async ingestFromUrl(url: string, options: IngestDocumentOptions): Promise<IngestResult> {
    logger.info('Ingesting document from URL', { url, category: options.category });

    // Step 1: Extract text from URL
    const extracted = await documentExtractor.extractFromUrl(url);

    // Step 2: Process and store
    return await this.processAndStore(extracted, options);
  }

  /**
   * Ingest plain text directly
   */
  async ingestFromText(
    text: string,
    options: IngestDocumentOptions & { fileName?: string }
  ): Promise<IngestResult> {
    logger.info('Ingesting plain text', { textLength: text.length, category: options.category });

    // Step 1: Wrap text as extracted document
    const extracted = documentExtractor.extractFromText(text, {
      fileName: options.fileName || 'text-input',
      fileType: 'txt',
    });

    // Step 2: Process and store
    return await this.processAndStore(extracted, options);
  }

  /**
   * Process extracted document and store in vector database
   */
  private async processAndStore(
    extracted: ExtractedDocument,
    options: IngestDocumentOptions
  ): Promise<IngestResult> {
    const startTime = Date.now();

    // Generate document ID
    const docId = this.generateDocId(options.source, extracted.metadata?.fileName);

    // Step 2: Chunk text using ChonkieJS
    logger.debug('Chunking text', { docId });
    const chunks = await textChunker.chunk(extracted.text, options.chunkerOptions);

    if (chunks.length === 0) {
      throw new Error('No chunks generated from document');
    }

    logger.info('Text chunked', {
      docId,
      chunks: chunks.length,
      avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length),
    });

    // Step 3: Generate embeddings for all chunks
    logger.debug('Generating embeddings', { docId, chunkCount: chunks.length });
    const chunkTexts = chunks.map((chunk) => chunk.text);
    const embeddingResult = await embeddingGenerator.generateEmbeddings(chunkTexts);

    logger.info('Embeddings generated', {
      docId,
      embeddings: embeddingResult.embeddings.length,
      tokensUsed: embeddingResult.totalTokensUsed,
    });

    // Step 4: Prepare vectors for Pinecone
    const vectors: VectorRecord[] = chunks.map((chunk, index) => ({
      id: `${docId}_chunk_${index}`,
      values: embeddingResult.embeddings[index],
      metadata: {
        docId,
        text: chunk.text,
        chunkIndex: index,
        totalChunks: chunks.length,
        startIndex: chunk.startIndex,
        endIndex: chunk.endIndex,
        tokenCount: chunk.tokenCount,
        source: options.source,
        category: options.category,
        fileName: extracted.metadata?.fileName,
        fileType: extracted.metadata?.fileType,
        fileSize: extracted.metadata?.fileSize,
        ingestedAt: new Date().toISOString(),
        ...options.metadata,
      },
    }));

    // Step 5: Upsert to Pinecone
    logger.debug('Upserting to Pinecone', { docId, vectorCount: vectors.length });
    await vectorStore.upsert(vectors);

    const duration = Date.now() - startTime;

    logger.info('Document ingestion complete', {
      docId,
      duration: `${duration}ms`,
      chunksIngested: chunks.length,
      tokensUsed: embeddingResult.totalTokensUsed,
    });

    return {
      docId,
      chunksIngested: chunks.length,
      totalTokensUsed: embeddingResult.totalTokensUsed,
      metadata: {
        fileName: extracted.metadata?.fileName,
        fileType: extracted.metadata?.fileType,
        fileSize: extracted.metadata?.fileSize,
        category: options.category,
        source: options.source,
        ingestedAt: new Date(),
      },
    };
  }

  /**
   * Query the knowledge base and retrieve relevant context
   */
  async query(question: string, options: QueryOptions = {}): Promise<RetrievalResult> {
    const { topK = 5, filter, includeScores = true, minScore = 0.0 } = options;

    logger.info('Querying knowledge base', { question: question.substring(0, 100), topK });

    const startTime = Date.now();

    // Step 1: Generate embedding for the question
    logger.debug('Generating query embedding');
    const queryEmbedding = await embeddingGenerator.generateEmbedding(question);

    // Step 2: Search Pinecone
    logger.debug('Searching vector store', { topK, hasFilter: !!filter });
    const results = await vectorStore.query(queryEmbedding.embedding, topK, filter);

    // Filter by minimum score
    const filteredResults = results.filter((result) => result.score >= minScore);

    if (filteredResults.length === 0) {
      logger.warn('No results found above minimum score', { minScore, originalResults: results.length });
      return {
        context: '',
        sources: [],
        tokensUsed: queryEmbedding.tokensUsed,
      };
    }

    // Step 3: Build context from results
    const context = this.buildContext(filteredResults, includeScores);

    const sources = filteredResults.map((result) => ({
      docId: result.metadata?.docId || 'unknown',
      chunkIndex: result.metadata?.chunkIndex || 0,
      score: result.score,
      text: result.metadata?.text || '',
      metadata: result.metadata,
    }));

    const duration = Date.now() - startTime;

    logger.info('Query complete', {
      duration: `${duration}ms`,
      resultsFound: filteredResults.length,
      contextLength: context.length,
      tokensUsed: queryEmbedding.tokensUsed,
    });

    return {
      context,
      sources,
      tokensUsed: queryEmbedding.tokensUsed,
    };
  }

  /**
   * Hybrid search (semantic + keyword)
   */
  async hybridQuery(question: string, options: QueryOptions = {}): Promise<RetrievalResult> {
    const { topK = 5, filter, includeScores = true, minScore = 0.0 } = options;

    logger.info('Hybrid query', { question: question.substring(0, 100), topK });

    const startTime = Date.now();

    // Step 1: Generate embedding for the question
    const queryEmbedding = await embeddingGenerator.generateEmbedding(question);

    // Step 2: Perform hybrid search
    const results = await vectorStore.hybridSearch(
      queryEmbedding.embedding,
      question,
      topK,
      0.5, // alpha: 0.5 = equal weight to semantic and keyword
      filter
    );

    // Filter by minimum score
    const filteredResults = results.filter((result) => result.score >= minScore);

    if (filteredResults.length === 0) {
      logger.warn('No results found in hybrid search', { minScore });
      return {
        context: '',
        sources: [],
        tokensUsed: queryEmbedding.tokensUsed,
      };
    }

    // Step 3: Build context
    const context = this.buildContext(filteredResults, includeScores);

    const sources = filteredResults.map((result) => ({
      docId: result.metadata?.docId || 'unknown',
      chunkIndex: result.metadata?.chunkIndex || 0,
      score: result.score,
      text: result.metadata?.text || '',
      metadata: result.metadata,
    }));

    const duration = Date.now() - startTime;

    logger.info('Hybrid query complete', {
      duration: `${duration}ms`,
      resultsFound: filteredResults.length,
      tokensUsed: queryEmbedding.tokensUsed,
    });

    return {
      context,
      sources,
      tokensUsed: queryEmbedding.tokensUsed,
    };
  }

  /**
   * Delete a document and all its chunks from the knowledge base
   */
  async deleteDocument(docId: string): Promise<void> {
    logger.info('Deleting document', { docId });

    // Query for all chunks of this document
    const results = await vectorStore.query(
      new Array(1536).fill(0), // Dummy vector
      100, // Get up to 100 chunks
      { docId } // Filter by docId
    );

    if (results.length === 0) {
      logger.warn('No chunks found for document', { docId });
      return;
    }

    // Delete all chunks
    const chunkIds = results.map((r) => r.id);
    await vectorStore.delete(chunkIds);

    logger.info('Document deleted', { docId, chunksDeleted: chunkIds.length });
  }

  /**
   * Get statistics about the knowledge base
   */
  async getStats(): Promise<{
    vectorCount: number;
    indexFullness: number;
    namespaces?: Record<string, { vectorCount: number }>;
  }> {
    const stats = await vectorStore.getStats();

    return {
      vectorCount: stats.totalVectorCount,
      indexFullness: stats.indexFullness,
      namespaces: stats.namespaces,
    };
  }

  /**
   * Build context string from query results
   */
  private buildContext(results: QueryResult[], includeScores: boolean): string {
    return results
      .map((result, index) => {
        const score = includeScores ? ` (Relevance: ${(result.score * 100).toFixed(1)}%)` : '';
        const source = result.metadata?.fileName || result.metadata?.source || 'Unknown';
        const text = result.metadata?.text || '';

        return `[Document ${index + 1}]${score}\nSource: ${source}\n${text}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Generate a unique document ID
   */
  private generateDocId(source: string, fileName?: string): string {
    const timestamp = Date.now();
    const name = fileName || source.split('/').pop() || 'doc';
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
    return `${cleanName}_${timestamp}`;
  }

  /**
   * Check if RAG pipeline is fully operational
   */
  isReady(): boolean {
    return embeddingGenerator.isAvailable() && vectorStore.isAvailable();
  }
}

// Export singleton instance
export const ragPipeline = new CustomRAGPipeline();
