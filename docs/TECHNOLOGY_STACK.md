# Technology Stack - Personal AI Automation Platform

## Executive Summary

This document provides detailed technology recommendations for building the personal AI automation platform. All selections are based on 2025 best practices, production readiness, community support, and alignment with project requirements.

---

## 🎯 Selection Criteria

For each technology choice, we prioritized:
- **Production Readiness**: Battle-tested in real-world applications
- **Developer Experience**: Good documentation, active community
- **Scalability**: Can grow from prototype to production
- **Cost Efficiency**: Reasonable pricing, especially for startups
- **Integration Quality**: Works well with other selected tools
- **Future-Proofing**: Active development, strong ecosystem

---

## 📦 Technology Stack Overview

```
┌─────────────────────────────────────────────────┐
│              FRONTEND (Optional)                 │
│  Next.js 14+ • React • TypeScript • TailwindCSS  │
└─────────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│                BACKEND/CORE                      │
│      Node.js 20+ • TypeScript 5+ • Express       │
└─────────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│              AI/AGENT LAYER                      │
│  LangGraph • LangChain • OpenAI/Anthropic API    │
│           Mastra (TypeScript framework)          │
└─────────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│              MEMORY SYSTEM                       │
│  Mem0 • Custom RAG • Pinecone • Redis           │
└─────────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│            INTEGRATIONS                          │
│  Google APIs • Resend • Custom API Clients       │
└─────────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│          SCHEDULING & JOBS                       │
│         BullMQ • Redis • Node-Cron               │
└─────────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│            DATA PERSISTENCE                      │
│   PostgreSQL • Redis • Pinecone • File Storage   │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Core Technologies

### 1. Runtime & Language

#### **Node.js 20 LTS**
**Why**:
- Native async/await for handling multiple agent operations
- Huge ecosystem for AI/ML (LangChain, OpenAI SDK)
- Excellent for I/O-heavy operations (API calls, database queries)
- Event-driven architecture fits agent coordination model

**Version**: 20.x (current LTS)

**Alternatives Considered**:
- Python: Great AI libraries, but TypeScript offers better type safety for complex orchestration
- Deno: Modern but smaller ecosystem

---

#### **TypeScript 5+**
**Why**:
- Type safety prevents bugs in complex agent interactions
- Better IDE support (autocomplete, refactoring)
- Self-documenting code for agent interfaces
- Industry standard for serious Node.js projects in 2025

**Configuration**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist"
  }
}
```

**Alternatives Considered**:
- JavaScript: Faster to write but loses type safety
- Other typed languages: Less AI tooling available

---

### 2. AI Agent Frameworks

#### **Primary: LangGraph** ⭐ RECOMMENDED
**Why**:
- **Best for complex orchestration**: Graph-based state machines
- **Multi-agent coordination**: Built-in patterns (sequential, parallel, hierarchical)
- **TypeScript support**: First-class TypeScript SDK
- **LangChain ecosystem**: Access to 1000+ integrations
- **Production ready**: Used by many companies in 2025
- **Human-in-the-loop**: Built-in approval workflows

**Use Cases**:
- Coordinating multiple agents
- Complex decision trees
- Conditional workflows
- Human approval steps

**Installation**:
```bash
npm install @langchain/langgraph @langchain/core
```

**Example Pattern**:
```typescript
import { StateGraph } from "@langchain/langgraph";

// Define multi-agent workflow
const workflow = new StateGraph()
  .addNode("research", researchAgent)
  .addNode("email", emailAgent)
  .addNode("approval", humanApproval)
  .addEdge("research", "email")
  .addEdge("email", "approval");
```

---

#### **Alternative: Mastra (TypeScript-native)**
**Why Consider**:
- **TypeScript-first**: Built specifically for TypeScript developers
- **Lightweight**: Less abstraction than LangChain
- **Modern**: Launched in 2024, designed for 2025 patterns
- **Good DX**: Clean API, easy to understand

**Use Cases**:
- Simpler workflows
- When you want more control
- Rapid prototyping

**Installation**:
```bash
npm install @mastra/core
```

**Trade-offs**:
- Smaller ecosystem than LangChain
- Newer, less battle-tested

---

#### **Supporting: LangChain**
**Why**:
- **Foundation**: Powers LangGraph
- **Tool integrations**: 1000+ pre-built connectors
- **RAG support**: Built-in document loaders, splitters
- **Prompt management**: Template system

**Installation**:
```bash
npm install langchain @langchain/openai @langchain/anthropic
```

---

#### **Alternative: CrewAI (Python)**
**Why NOT chosen for primary**:
- Excellent for role-based teams, but Python-based
- We chose TypeScript for this project
- Still worth monitoring for future Python components

---

### 3. LLM Providers

#### **Primary: OpenAI (GPT-4 Turbo / GPT-4o)** ⭐ RECOMMENDED
**Why**:
- **Best performance**: Industry-leading for reasoning
- **Function calling**: Excellent tool use capabilities
- **Reliability**: 99.9% uptime SLA
- **Ecosystem**: Most integrations available

**Pricing** (as of 2025):
- GPT-4 Turbo: $10/1M input tokens, $30/1M output tokens
- GPT-4o (faster): $5/1M input, $15/1M output

**Use Cases**:
- Complex reasoning tasks
- Multi-step planning
- Email composition
- Knowledge synthesis

**Installation**:
```bash
npm install openai
```

---

#### **Alternative: Anthropic Claude 3.5 Sonnet**
**Why Consider**:
- **Longer context**: 200K tokens (vs OpenAI's 128K)
- **Better at following instructions**: Excellent for structured output
- **Competitive pricing**: Similar to GPT-4
- **Safety**: Strong alignment, less prone to jailbreaks

**Pricing**:
- Claude 3.5 Sonnet: $3/1M input, $15/1M output

**Use Cases**:
- Long document analysis
- Precise instruction following
- When you need larger context windows

**Installation**:
```bash
npm install @anthropic-ai/sdk
```

---

#### **Strategy: Multi-Provider**
**Recommendation**: Support both OpenAI and Anthropic
- Use OpenAI for general tasks
- Use Claude for long documents or when context matters
- Allow users to choose preferred provider
- Fallback mechanism if one provider is down

---

### 4. Memory & Knowledge Systems

#### **Long-Term Memory: Mem0** ⭐ RECOMMENDED
**Why**:
- **Best performance**: 92% faster than alternatives (benchmarks)
- **Cost efficient**: 90% lower token usage vs full-context
- **Accurate**: 26% better than OpenAI's memory
- **Production ready**: Used by many startups in 2025

**Features**:
- Episodic memory (conversation history)
- Semantic memory (knowledge base)
- Automatic summarization
- Multi-user support

**Pricing**:
- Free tier: 10K memories
- Pro: $20/month for 1M memories

**Installation**:
```bash
npm install mem0ai
```

**Alternatives Considered**:
- **Zep**: Good but higher latency (1.3s vs 0.4s)
- **LangMem**: Too slow (18s p50 latency - not production ready)

---

#### **Vector Database: Pinecone** ⭐ RECOMMENDED
**Why**:
- **Serverless**: No infrastructure management
- **Fast**: Sub-50ms queries at billion-scale
- **Reliable**: 99.9% uptime SLA
- **Easy**: Simple API, quick setup

**Features**:
- Hybrid search (vector + metadata filtering)
- Namespaces for multi-tenancy
- Built-in analytics

**Pricing**:
- Free tier: 100K vectors (good for MVP)
- Starter: $70/month for 10M vectors

**Installation**:
```bash
npm install @pinecone-database/pinecone
```

**Alternatives**:
- **Weaviate**: Open-source, self-hosted option (more complex)
- **ChromaDB**: Lightweight for prototypes (not for production scale)

**Decision Matrix**:
| Feature | Pinecone | Weaviate | ChromaDB |
|---------|----------|----------|----------|
| Setup Complexity | Easy | Medium | Easy |
| Scaling | Automatic | Manual | Limited |
| Latency | <50ms | 100-200ms | Varies |
| Cost (10M vectors) | $70/mo | $200/mo (infra) | Free (self-hosted) |
| **Best For** | **Production** | On-premise | Prototyping |

**Recommendation**: Start with Pinecone, migrate to Weaviate if you need on-premise or lower cost at scale.

---

#### **RAG System: Custom Pipeline** ⭐ RECOMMENDED
**Why Custom Over LlamaIndex**:
- **Full control**: Fine-tune every step of the pipeline
- **Optimized for use case**: Tailored to document types and query patterns
- **Less abstraction**: Direct API calls, easier to debug
- **Better OCR**: Mistral OCR for superior document extraction
- **Hybrid search**: Native Pinecone hybrid search (vector + BM25 keyword)
- **Performance**: No framework overhead
- **Cost efficient**: Embeddings at $0.0001/1K tokens

**Components**:

**1. Document Extraction: Mistral OCR API**
- High-quality text extraction from PDFs, images, documents
- Handles complex layouts and multi-column text
- Supports multiple languages

**Installation**:
```bash
npm install axios form-data
```

**Usage**:
```typescript
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

async function extractTextFromDocument(filePath: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  const response = await axios.post('https://api.mistral.ai/v1/ocr', formData, {
    headers: {
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      ...formData.getHeaders(),
    },
  });

  return response.data.text;
}
```

**2. Text Chunking: ChonkieJS**
- Fast, lightweight, and efficient chunking
- Multiple chunking strategies (Token, Semantic, Recursive, Sentence)
- TypeScript-native with full type safety
- Multilingual support (56 languages)

**Installation**:
```bash
npm install @chonkiejs/core
```

**Usage**:
```typescript
import { RecursiveChunker } from '@chonkiejs/core';

// Create chunker with overlap for context
const chunker = await RecursiveChunker.create({
  chunkSize: 1000,
  chunkOverlap: 200,
});

// Chunk text
const chunks = await chunker.chunk(text);

for (const chunk of chunks) {
  console.log(`Text: ${chunk.text}`);
  console.log(`Tokens: ${chunk.tokenCount}`);
}
```

**Chunking Strategies Available**:
- **TokenChunker**: Fixed-size token chunks
- **RecursiveChunker**: Hierarchical splitting (recommended)
- **SemanticChunker**: Semantic similarity-based
- **SentenceChunker**: Sentence boundary-based
- **WordChunker**: Word count-based

**3. Embeddings: OpenAI text-embedding-ada-002**
- High quality embeddings (1536 dimensions)
- Very affordable ($0.0001 / 1K tokens)
- Proven performance for semantic search

**Installation**:
```bash
npm install openai
```

**Usage**:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });

  return response.data[0].embedding;
}
```

**4. Complete Custom RAG Pipeline**

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveChunker } from '@chonkiejs/core';
import OpenAI from 'openai';

export class CustomRAGPipeline {
  private pinecone;
  private index;
  private openai;
  private chunker;

  constructor() {
    this.pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    this.index = this.pinecone.index('coask-knowledge');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async initialize() {
    this.chunker = await RecursiveChunker.create({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  // Ingest document into knowledge base
  async ingestDocument(filePath: string, metadata: any = {}) {
    // 1. Extract text using Mistral OCR
    const text = await extractTextFromDocument(filePath);

    // 2. Chunk text using ChonkieJS
    const chunks = await this.chunker.chunk(text);

    // 3. Generate embeddings and upsert to Pinecone
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.generateEmbedding(chunk.text);

      await this.index.upsert([{
        id: `${metadata.docId || 'doc'}_chunk_${i}`,
        values: embedding,
        metadata: {
          text: chunk.text,
          tokenCount: chunk.tokenCount,
          chunkIndex: i,
          totalChunks: chunks.length,
          source: filePath,
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      }]);
    }

    return { chunksCreated: chunks.length };
  }

  // Query knowledge base with hybrid search
  async query(question: string, topK: number = 5): Promise<string> {
    // 1. Generate query embedding
    const queryEmbedding = await this.generateEmbedding(question);

    // 2. Hybrid search (vector + keyword)
    const results = await this.index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      // Pinecone hybrid search combines vector similarity with BM25 keyword matching
    });

    // 3. Format context for LLM
    const context = results.matches
      .map((match, i) => {
        return `[Document ${i + 1}] (Relevance: ${(match.score * 100).toFixed(1)}%)\n${match.metadata?.text}`;
      })
      .join('\n\n---\n\n');

    return context;
  }

  // Query with metadata filtering
  async queryWithFilter(question: string, filter: any, topK: number = 5): Promise<string> {
    const queryEmbedding = await this.generateEmbedding(question);

    const results = await this.index.query({
      vector: queryEmbedding,
      topK,
      filter, // e.g., { category: { $eq: 'email_templates' } }
      includeMetadata: true,
    });

    const context = results.matches
      .map((match, i) => `[${i + 1}] ${match.metadata?.text}`)
      .join('\n\n');

    return context;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  }
}
```

**Usage Example**:
```typescript
// Initialize pipeline
const rag = new CustomRAGPipeline();
await rag.initialize();

// Ingest document
await rag.ingestDocument('./docs/product_guide.pdf', {
  docId: 'product_guide',
  category: 'documentation',
  version: '2.0',
});

// Query knowledge base
const context = await rag.query('What are our pricing tiers?');

// Use context in LLM prompt
const answer = await callLLM(`
  Context: ${context}

  Question: What are our pricing tiers?

  Answer based on the context above:
`);
```

**Optimization Options**:

**1. Hybrid Search Tuning**
```typescript
await index.query({
  vector: queryEmbedding,
  topK: 5,
  alpha: 0.7, // 70% vector, 30% keyword (if supported by Pinecone)
});
```

**2. Reranking** (optional for better accuracy)
```typescript
// Get top 20 results, rerank to top 5
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
const reranked = await cohere.rerank({
  query: question,
  documents: results.map(r => r.metadata.text),
  topN: 5,
});
```

**3. Caching** (Redis for frequent queries)
```typescript
async query(question: string, topK: number = 5): Promise<string> {
  // Check cache first
  const cacheKey = `query:${question}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  // Query and cache result
  const context = await this.performQuery(question, topK);
  await redis.setex(cacheKey, 3600, context); // Cache for 1 hour

  return context;
}
```

**Cost Analysis**:
- **Mistral OCR**: Check Mistral pricing (document-based)
- **OpenAI Embeddings**: $0.0001 / 1K tokens (~$0.10 per 1M tokens)
- **Pinecone**: $70/month for 10M vectors (same as before)
- **Total Added Cost**: Minimal (~$5-10/month for embeddings at scale)

**When LlamaIndex Would Be Better**:
- Experimenting with many different retrieval strategies
- Need quick prototyping with multiple data sources
- Want pre-built loaders for various file formats

**For Coask**: Custom pipeline is superior because:
- ✅ Focused use case (company docs, email templates)
- ✅ Need full control over chunking and retrieval
- ✅ Want to optimize for specific query patterns
- ✅ Prefer direct API integration (less black box)
- ✅ Easier debugging and monitoring

---

### 5. Scheduling & Job Queue

#### **BullMQ** ⭐ RECOMMENDED
**Why**:
- **Rock solid**: Most popular Node.js job queue
- **Redis-backed**: Reliable, persistent
- **Feature-rich**: Cron, delays, priorities, retries
- **Scalable**: Distributed workers
- **Observable**: Built-in Bull Board for monitoring

**Features**:
- Cron scheduling
- Job prioritization
- Automatic retries with exponential backoff
- Rate limiting
- Job events (completed, failed, progress)

**Installation**:
```bash
npm install bullmq
npm install @bull-board/api @bull-board/express  # For UI
```

**Example**:
```typescript
import { Queue, Worker } from 'bullmq';

// Define queue
const emailQueue = new Queue('email-campaigns');

// Add recurring job
await emailQueue.add('send-campaign',
  { campaignId: '123' },
  { repeat: { cron: '0 9 * * *' } }  // Daily at 9 AM
);

// Worker
const worker = new Worker('email-campaigns', async (job) => {
  // Process job
  await sendEmails(job.data.campaignId);
});
```

**Alternatives Considered**:
- **Agenda**: Simpler but less reliable
- **node-cron**: Good for simple cron, but no queue features
- **Temporal**: Overkill for this project (better for microservices)

---

### 6. External Integrations

#### **Google Workspace APIs**
**Why**:
- Direct access to Gmail, Calendar, Docs
- Official SDKs
- Required for Google services

**Authentication**: OAuth 2.0 (mandatory as of March 2025)

**Installation**:
```bash
npm install googleapis
```

**APIs to Use**:
- `gmail.users.messages.send` - Send emails
- `calendar.events.insert` - Create events
- `docs.documents.create` - Create documents

**Scopes Needed**:
```
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/documents
```

---

#### **Email Service: Resend** ⭐ RECOMMENDED for MVP
**Why**:
- **Modern DX**: Built by developers, for developers
- **React Email**: Built-in template system
- **Affordable**: $20/month for 50K emails
- **Good deliverability**: Competitive with Postmark
- **Generous free tier**: 3K emails/month

**Pricing**:
- Free: 3K emails/month
- Pro: $20/month for 50K emails

**Installation**:
```bash
npm install resend
npm install react-email  # For templates
```

**Example**:
```typescript
import { Resend } from 'resend';

const resend = new Resend('re_...');

await resend.emails.send({
  from: 'you@yourdomain.com',
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<p>Hello world</p>'
});
```

**Alternatives**:
- **Postmark**: Best deliverability (22% better than SendGrid), but pricier
- **SendGrid**: Enterprise option, complex pricing
- **Mailgun**: Similar to SendGrid

**Recommendation**:
- **Start with Resend** (MVP, early stage)
- **Switch to Postmark** if deliverability is critical (e.g., transactional emails)
- **Switch to SendGrid** if you need advanced marketing features

---

#### **HTTP Client: Axios**
**Why**:
- Standard for Node.js HTTP requests
- Interceptors for auth/logging
- Good error handling

**Installation**:
```bash
npm install axios
```

---

### 7. Data Persistence

#### **Primary Database: PostgreSQL 15+** ⭐ RECOMMENDED
**Why**:
- **Reliable**: ACID compliant
- **Feature-rich**: JSON support, full-text search
- **Scalable**: Read replicas, partitioning
- **Well-supported**: Many hosting options

**Use Cases**:
- User accounts
- Task history
- Integration credentials (encrypted)
- Analytics data

**ORM: Prisma**
**Why**:
- Type-safe queries
- Automatic migrations
- Great TypeScript support

**Installation**:
```bash
npm install @prisma/client
npm install -D prisma
```

**Example Schema**:
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  tasks     Task[]
}

model Task {
  id        String   @id @default(uuid())
  type      String
  status    String
  result    Json?
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

**Alternatives Considered**:
- **MongoDB**: Good for flexible schemas, but less ideal for relational data
- **MySQL**: Similar to Postgres, but less feature-rich

---

#### **Cache/Queue: Redis 7+**
**Why**:
- **Fast**: In-memory, sub-millisecond latency
- **Versatile**: Cache, queue, session storage
- **Required**: BullMQ needs Redis

**Use Cases**:
- BullMQ job queue
- Working memory (active context)
- Session storage
- API response caching

**Hosting Options**:
- **Upstash**: Serverless Redis, great free tier
- **Redis Cloud**: Official managed service
- **Railway/Render**: Easy deployment

**Installation**:
```bash
npm install ioredis  # Better than node-redis
```

---

#### **File Storage: AWS S3 / Cloudflare R2**
**Why**:
- Store uploaded files (CSVs, documents)
- Store generated reports
- Backup knowledge base documents

**Recommendation**: **Cloudflare R2**
- S3-compatible API
- Zero egress fees (vs AWS charges)
- $0.015/GB storage

**Installation**:
```bash
npm install @aws-sdk/client-s3  # Works with R2
```

---

### 8. Monitoring & Observability

#### **Logging: Winston**
**Why**:
- Structured JSON logging
- Multiple transports (console, file, cloud)
- Log levels

**Installation**:
```bash
npm install winston
```

**Configuration**:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

---

#### **APM: Sentry**
**Why**:
- Error tracking
- Performance monitoring
- Free tier available

**Installation**:
```bash
npm install @sentry/node
```

---

#### **Metrics: Prometheus + Grafana** (Optional for production)
**Why**:
- Industry standard
- Custom metrics
- Beautiful dashboards

**When to Add**: After MVP, when you need detailed metrics

---

### 9. Development Tools

#### **Package Manager: pnpm**
**Why**:
- Faster than npm/yarn
- Efficient disk usage
- Workspace support

**Installation**:
```bash
npm install -g pnpm
```

---

#### **Code Quality: ESLint + Prettier**
**Why**:
- Enforce code style
- Catch common mistakes
- Auto-formatting

**Installation**:
```bash
pnpm add -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

---

#### **Testing: Vitest**
**Why**:
- Fast (powered by Vite)
- TypeScript support
- Jest-compatible API

**Installation**:
```bash
pnpm add -D vitest
```

---

### 10. Deployment & Infrastructure

#### **Platform: Railway / Render** ⭐ RECOMMENDED for MVP
**Why**:
- One-click deployment
- Auto-scaling
- Built-in databases (Postgres, Redis)
- Affordable ($5-20/month to start)

**Alternatives**:
- **Vercel**: Great for Next.js frontend, limited for backend workers
- **AWS/GCP**: More powerful, but complex setup
- **Docker + VPS**: Most control, but requires DevOps expertise

---

#### **Containerization: Docker**
**Why**:
- Consistent environments
- Easy deployment
- Good for future scaling

**Dockerfile Example**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

---

## 📊 Cost Estimation (Monthly)

### MVP / Small Scale (< 10 users, < 10K emails/month)

| Service | Plan | Cost |
|---------|------|------|
| OpenAI API | Pay-as-you-go | ~$50 |
| Pinecone | Free tier | $0 |
| Mem0 | Free tier | $0 |
| Resend | Free tier | $0 |
| Redis | Upstash free | $0 |
| PostgreSQL | Railway free | $0 |
| Hosting | Railway hobby | $5 |
| **Total** | | **~$55/month** |

---

### Growth / Production (100 users, 100K emails/month)

| Service | Plan | Cost |
|---------|------|------|
| OpenAI API | Pay-as-you-go | ~$200 |
| Pinecone | Starter (10M vectors) | $70 |
| Mem0 | Pro (1M memories) | $20 |
| Resend | Pro (50K emails) | $20 |
| Postmark | 50K emails (if switching) | $50 |
| Redis | Upstash pay-as-you-go | $10 |
| PostgreSQL | Railway pro | $10 |
| Hosting | Railway pro | $20 |
| **Total** | | **~$350-380/month** |

---

## 🔄 Migration Path

### Phase 1: Prototype
- Free tiers everywhere
- Pinecone free (100K vectors)
- Resend free (3K emails)
- Railway free tier

### Phase 2: Early Production
- Upgrade Pinecone ($70)
- Upgrade Resend ($20) or keep free
- Upgrade hosting ($20)

### Phase 3: Scale
- Consider Weaviate self-hosted (cost savings on vectors)
- Switch to Postmark if deliverability issues
- Add Prometheus/Grafana for metrics
- Scale databases (read replicas)

---

## 🎯 Technology Decision Summary

### Core Stack (Recommended)
```
Runtime:       Node.js 20 + TypeScript 5
Backend:       Express
AI Framework:  LangGraph + LangChain
LLM:           OpenAI GPT-4 Turbo (primary), Claude 3.5 (fallback)
Memory:        Mem0 + Pinecone
RAG:           Custom Pipeline (Mistral OCR + ChonkieJS + OpenAI Embeddings + Pinecone)
Queue:         BullMQ + Redis
Database:      PostgreSQL (Prisma ORM)
Cache:         Redis (Upstash)
Email:         Resend (MVP), Postmark (production)
Google:        Google APIs (OAuth 2.0)
Hosting:       Railway / Render
Storage:       Cloudflare R2
Monitoring:    Winston + Sentry
```

---

## 🚀 Getting Started (Quick Setup)

### 1. Initialize Project
```bash
mkdir coask
cd coask
pnpm init
pnpm add typescript @types/node tsx -D
npx tsc --init
```

### 2. Install Core Dependencies
```bash
# AI & Agents
pnpm add @langchain/langgraph @langchain/core langchain
pnpm add openai @anthropic-ai/sdk

# RAG Pipeline Components
pnpm add @chonkiejs/core axios form-data

# Memory & Vector DB
pnpm add mem0ai @pinecone-database/pinecone

# Job Queue
pnpm add bullmq ioredis
pnpm add @bull-board/api @bull-board/express

# Database
pnpm add @prisma/client
pnpm add -D prisma

# Integrations
pnpm add googleapis resend axios

# Server
pnpm add express
pnpm add -D @types/express

# Utilities
pnpm add dotenv zod winston
```

### 3. Environment Variables
```bash
# .env
# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# RAG Pipeline
MISTRAL_API_KEY=...
PINECONE_API_KEY=...

# Email & Integrations
RESEND_API_KEY=re_...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Infrastructure
REDIS_URL=redis://...
DATABASE_URL=postgresql://...
```

### 4. Project Structure
```
coask/
├── src/
│   ├── agents/          # AI agents
│   ├── integrations/    # External APIs
│   ├── memory/          # Memory systems
│   ├── queue/           # Job queue
│   ├── routes/          # API routes
│   ├── utils/           # Helpers
│   └── index.ts         # Entry point
├── prisma/
│   └── schema.prisma    # Database schema
├── docs/                # Documentation
├── tests/               # Tests
├── package.json
└── tsconfig.json
```

---

## 📚 Learning Resources

### Official Docs
- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [LangChain Docs](https://js.langchain.com/)
- [Pinecone Docs](https://docs.pinecone.io/)
- [BullMQ Docs](https://docs.bullmq.io/)

### Tutorials
- [Building AI Agents with TypeScript](https://www.freecodecamp.org/news/how-to-build-rag-ai-agents-with-typescript/)
- [Multi-Agent Systems with LangGraph](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/)

---

## ✅ Next Steps

1. Review this stack with your team
2. Set up development environment
3. Start with MVP features (see Implementation Roadmap)
4. Build one agent at a time
5. Test integrations thoroughly
6. Deploy to staging
7. Iterate based on feedback

---

**Questions or feedback?** This stack is designed to be flexible — if you have specific needs or constraints, we can adjust individual components while maintaining the overall architecture.
