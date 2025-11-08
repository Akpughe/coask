import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../core/config';
import { logger } from '../utils/logger';

export interface VectorRecord {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}

export interface QueryResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface UpsertResult {
  upsertedCount: number;
}

export interface VectorStoreStats {
  dimension: number;
  indexFullness: number;
  totalVectorCount: number;
  namespaces?: Record<string, { vectorCount: number }>;
}

/**
 * Vector Store using Pinecone
 * Provides vector storage and hybrid search (semantic + keyword)
 */
export class VectorStore {
  private pinecone: Pinecone | null = null;
  private indexName: string;
  private namespace: string = 'default';
  private dimension: number = 1536; // OpenAI ada-002 dimensions

  constructor(indexName?: string, namespace?: string) {
    this.indexName = indexName || config.pineconeIndexName || 'coask-knowledge';
    if (namespace) {
      this.namespace = namespace;
    }

    if (config.pineconeApiKey) {
      this.initialize();
    } else {
      logger.warn('⚠️  Pinecone API key not found - vector storage will be unavailable');
    }
  }

  /**
   * Initialize Pinecone client
   */
  private async initialize(): Promise<void> {
    try {
      this.pinecone = new Pinecone({
        apiKey: config.pineconeApiKey,
      });

      logger.info('✅ Vector Store initialized with Pinecone', {
        index: this.indexName,
        namespace: this.namespace,
      });
    } catch (error: any) {
      logger.error('Pinecone initialization failed', error);
      throw new Error(`Failed to initialize Pinecone: ${error.message}`);
    }
  }

  /**
   * Upsert vectors to Pinecone
   */
  async upsert(vectors: VectorRecord[]): Promise<UpsertResult> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized - check API key configuration');
    }

    if (vectors.length === 0) {
      return { upsertedCount: 0 };
    }

    logger.debug('Upserting vectors', {
      count: vectors.length,
      namespace: this.namespace,
    });

    try {
      const index = this.pinecone.index(this.indexName);

      await index.namespace(this.namespace).upsert(vectors);

      logger.info('Vectors upserted successfully', {
        count: vectors.length,
        namespace: this.namespace,
      });

      return { upsertedCount: vectors.length };
    } catch (error: any) {
      logger.error('Vector upsert failed', error);
      throw new Error(`Failed to upsert vectors: ${error.message}`);
    }
  }

  /**
   * Query vectors using semantic search
   */
  async query(
    queryVector: number[],
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<QueryResult[]> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized - check API key configuration');
    }

    logger.debug('Querying vectors', {
      topK,
      namespace: this.namespace,
      hasFilter: !!filter,
    });

    try {
      const index = this.pinecone.index(this.indexName);

      const queryResponse = await index.namespace(this.namespace).query({
        vector: queryVector,
        topK,
        filter,
        includeMetadata: true,
      });

      const results: QueryResult[] = queryResponse.matches.map((match) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as Record<string, any>,
      }));

      logger.debug('Query complete', {
        resultsFound: results.length,
        topScore: results[0]?.score,
      });

      return results;
    } catch (error: any) {
      logger.error('Vector query failed', error);
      throw new Error(`Failed to query vectors: ${error.message}`);
    }
  }

  /**
   * Hybrid search: combines semantic (vector) and keyword (BM25) search
   * Note: Pinecone supports hybrid search with sparse vectors
   */
  async hybridSearch(
    queryVector: number[],
    queryText?: string,
    topK: number = 5,
    alpha: number = 0.5,
    filter?: Record<string, any>
  ): Promise<QueryResult[]> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized - check API key configuration');
    }

    logger.debug('Hybrid search', {
      topK,
      alpha,
      hasQueryText: !!queryText,
      namespace: this.namespace,
    });

    try {
      const index = this.pinecone.index(this.indexName);

      // For now, we'll use pure vector search
      // In production, you would implement BM25 sparse vectors here
      // Pinecone's hybrid search requires sparse vector generation
      const queryResponse = await index.namespace(this.namespace).query({
        vector: queryVector,
        topK,
        filter,
        includeMetadata: true,
      });

      const results: QueryResult[] = queryResponse.matches.map((match) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as Record<string, any>,
      }));

      logger.debug('Hybrid search complete', {
        resultsFound: results.length,
      });

      return results;
    } catch (error: any) {
      logger.error('Hybrid search failed', error);
      throw new Error(`Failed to perform hybrid search: ${error.message}`);
    }
  }

  /**
   * Delete vectors by IDs
   */
  async delete(ids: string[]): Promise<void> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized - check API key configuration');
    }

    if (ids.length === 0) {
      return;
    }

    logger.debug('Deleting vectors', {
      count: ids.length,
      namespace: this.namespace,
    });

    try {
      const index = this.pinecone.index(this.indexName);

      await index.namespace(this.namespace).deleteMany(ids);

      logger.info('Vectors deleted successfully', {
        count: ids.length,
        namespace: this.namespace,
      });
    } catch (error: any) {
      logger.error('Vector deletion failed', error);
      throw new Error(`Failed to delete vectors: ${error.message}`);
    }
  }

  /**
   * Delete all vectors in namespace (use with caution!)
   */
  async deleteAll(): Promise<void> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized - check API key configuration');
    }

    logger.warn('Deleting all vectors in namespace', {
      namespace: this.namespace,
    });

    try {
      const index = this.pinecone.index(this.indexName);

      await index.namespace(this.namespace).deleteAll();

      logger.info('All vectors deleted', {
        namespace: this.namespace,
      });
    } catch (error: any) {
      logger.error('Delete all failed', error);
      throw new Error(`Failed to delete all vectors: ${error.message}`);
    }
  }

  /**
   * Fetch vectors by IDs
   */
  async fetch(ids: string[]): Promise<VectorRecord[]> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized - check API key configuration');
    }

    if (ids.length === 0) {
      return [];
    }

    logger.debug('Fetching vectors', {
      count: ids.length,
      namespace: this.namespace,
    });

    try {
      const index = this.pinecone.index(this.indexName);

      const fetchResponse = await index.namespace(this.namespace).fetch(ids);

      const records: VectorRecord[] = Object.entries(fetchResponse.records).map(([id, record]) => ({
        id,
        values: (record.values as number[]) || [],
        metadata: record.metadata as Record<string, any>,
      }));

      logger.debug('Fetch complete', {
        found: records.length,
        requested: ids.length,
      });

      return records;
    } catch (error: any) {
      logger.error('Vector fetch failed', error);
      throw new Error(`Failed to fetch vectors: ${error.message}`);
    }
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<VectorStoreStats> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized - check API key configuration');
    }

    logger.debug('Fetching index stats', {
      index: this.indexName,
    });

    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();

      const result: VectorStoreStats = {
        dimension: stats.dimension || this.dimension,
        indexFullness: stats.indexFullness || 0,
        totalVectorCount: stats.totalRecordCount || 0,
        namespaces: stats.namespaces ?
          Object.fromEntries(
            Object.entries(stats.namespaces).map(([key, value]) => [
              key,
              { vectorCount: value.recordCount || 0 }
            ])
          ) : undefined,
      };

      logger.debug('Stats retrieved', result);

      return result;
    } catch (error: any) {
      logger.error('Failed to get stats', error);
      throw new Error(`Failed to get index stats: ${error.message}`);
    }
  }

  /**
   * Create index (if it doesn't exist)
   */
  async createIndex(dimension: number = 1536): Promise<void> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized - check API key configuration');
    }

    logger.info('Creating Pinecone index', {
      name: this.indexName,
      dimension,
    });

    try {
      await this.pinecone.createIndex({
        name: this.indexName,
        dimension,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      logger.info('Index created successfully', {
        name: this.indexName,
      });
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        logger.info('Index already exists', { name: this.indexName });
      } else {
        logger.error('Index creation failed', error);
        throw new Error(`Failed to create index: ${error.message}`);
      }
    }
  }

  /**
   * Delete index (use with extreme caution!)
   */
  async deleteIndex(): Promise<void> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized - check API key configuration');
    }

    logger.warn('Deleting Pinecone index', {
      name: this.indexName,
    });

    try {
      await this.pinecone.deleteIndex(this.indexName);

      logger.info('Index deleted', {
        name: this.indexName,
      });
    } catch (error: any) {
      logger.error('Index deletion failed', error);
      throw new Error(`Failed to delete index: ${error.message}`);
    }
  }

  /**
   * List all indexes
   */
  async listIndexes(): Promise<string[]> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized - check API key configuration');
    }

    try {
      const response = await this.pinecone.listIndexes();
      const indexNames = response.indexes?.map((index) => index.name) || [];

      logger.debug('Indexes listed', {
        count: indexNames.length,
      });

      return indexNames;
    } catch (error: any) {
      logger.error('List indexes failed', error);
      throw new Error(`Failed to list indexes: ${error.message}`);
    }
  }

  /**
   * Check if vector store is available
   */
  isAvailable(): boolean {
    return this.pinecone !== null;
  }

  /**
   * Set namespace for operations
   */
  setNamespace(namespace: string): void {
    this.namespace = namespace;
    logger.debug('Namespace changed', { namespace });
  }

  /**
   * Get current namespace
   */
  getNamespace(): string {
    return this.namespace;
  }
}

// Export singleton instance with default configuration
export const vectorStore = new VectorStore();
