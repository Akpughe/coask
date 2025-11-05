# Implementation Roadmap - Personal AI Automation Platform

## Executive Summary

This roadmap breaks down the implementation into **6 phases**, progressing from a simple MVP to a full-featured multi-agent automation platform. Each phase delivers usable functionality and builds upon previous phases.

**Estimated Timeline**: 3-6 months (depending on team size and hours/week)

**Recommended Approach**:
- Build iteratively
- Get feedback early and often
- Don't over-engineer early phases
- Test each phase thoroughly before moving on

---

## 🎯 Phase Overview

| Phase | Focus | Duration | Outcome |
|-------|-------|----------|---------|
| **Phase 0** | Setup & Foundation | 1 week | Development environment ready |
| **Phase 1** | Single Agent + Basic Memory | 2-3 weeks | Simple email agent working |
| **Phase 2** | Knowledge Base + RAG | 2-3 weeks | Agent uses stored knowledge |
| **Phase 3** | Multi-Agent System | 3-4 weeks | Coordinated agents working together |
| **Phase 4** | Scheduling & Automation | 2-3 weeks | Recurring tasks running automatically |
| **Phase 5** | Integrations & Polish | 2-4 weeks | Full integration suite + UI |
| **Phase 6** | Production & Scale | Ongoing | Monitoring, optimization, scale |

---

## 📋 Phase 0: Setup & Foundation
**Duration**: 1 week
**Goal**: Create a solid development environment and project structure

### Tasks

#### 1. Project Initialization
```bash
# Initialize project
mkdir coask && cd coask
pnpm init
git init

# Setup TypeScript
pnpm add -D typescript @types/node tsx
npx tsc --init

# Basic dependencies
pnpm add express dotenv
pnpm add -D @types/express nodemon

# Code quality
pnpm add -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

#### 2. Project Structure
```
coask/
├── src/
│   ├── agents/              # AI agents (empty for now)
│   ├── core/
│   │   ├── llm.ts          # LLM client wrapper
│   │   └── config.ts       # Configuration
│   ├── integrations/        # External APIs (empty for now)
│   ├── memory/             # Memory systems (empty for now)
│   ├── queue/              # Job queue (Phase 4)
│   ├── routes/
│   │   └── api.ts          # API routes
│   ├── utils/
│   │   └── logger.ts       # Logging
│   └── index.ts            # Entry point
├── prisma/
│   └── schema.prisma       # Database schema
├── tests/                  # Tests
├── docs/                   # Documentation
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── TECHNOLOGY_STACK.md
│   └── IMPLEMENTATION_ROADMAP.md
├── .env.example            # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

#### 3. Environment Setup
Create `.env.example`:
```bash
# LLM
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL=postgresql://localhost:5432/coask
REDIS_URL=redis://localhost:6379

# Services (add later)
RESEND_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
PINECONE_API_KEY=

# App
NODE_ENV=development
PORT=3000
```

#### 4. Basic Server
Create `src/index.ts`:
```typescript
import express from 'express';
import { config } from './core/config';
import { logger } from './utils/logger';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});
```

#### 5. Database Setup
Setup Prisma:
```bash
pnpm add @prisma/client
pnpm add -D prisma
npx prisma init
```

Basic schema (`prisma/schema.prisma`):
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### 6. Development Scripts
Add to `package.json`:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  }
}
```

### Deliverables
- ✅ Project structure created
- ✅ TypeScript configured
- ✅ Database connected
- ✅ Basic server running
- ✅ Git repository initialized
- ✅ Development workflow working

---

## 🤖 Phase 1: Single Agent + Basic Memory
**Duration**: 2-3 weeks
**Goal**: Build a working email agent with simple memory

### What You'll Build
A single AI agent that can:
- Understand user requests in natural language
- Compose emails based on instructions
- Remember previous conversations
- Show drafts for approval
- Send emails via Resend

### Tasks

#### 1. LLM Integration
Create `src/core/llm.ts`:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function callLLM(prompt: string, systemPrompt?: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: prompt },
    ],
  });
  return response.choices[0].message.content;
}
```

#### 2. Simple Email Agent
Create `src/agents/email-agent.ts`:
```typescript
import { callLLM } from '../core/llm';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailAgent {
  async composeEmail(request: {
    recipient: string;
    purpose: string;
    context?: string;
  }) {
    const prompt = `
      Compose a professional email for the following:

      Recipient: ${request.recipient}
      Purpose: ${request.purpose}
      ${request.context ? `Context: ${request.context}` : ''}

      Return just the email body (no subject line).
    `;

    const emailBody = await callLLM(prompt, 'You are a professional email writer.');

    return {
      to: request.recipient,
      subject: this.generateSubject(request.purpose),
      body: emailBody,
    };
  }

  async sendEmail(email: { to: string; subject: string; body: string }) {
    await resend.emails.send({
      from: 'you@yourdomain.com',
      to: email.to,
      subject: email.subject,
      html: email.body,
    });
  }

  private generateSubject(purpose: string): string {
    // Simple subject generation (can enhance later)
    return purpose.split(' ').slice(0, 5).join(' ');
  }
}
```

#### 3. Basic Memory (In-Memory)
Create `src/memory/conversation-memory.ts`:
```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export class ConversationMemory {
  private conversations: Map<string, Message[]> = new Map();

  addMessage(userId: string, role: 'user' | 'assistant', content: string) {
    const messages = this.conversations.get(userId) || [];
    messages.push({ role, content, timestamp: new Date() });
    this.conversations.set(userId, messages);
  }

  getHistory(userId: string, limit: number = 10): Message[] {
    const messages = this.conversations.get(userId) || [];
    return messages.slice(-limit);
  }

  clear(userId: string) {
    this.conversations.delete(userId);
  }
}
```

#### 4. API Routes
Create `src/routes/agent-routes.ts`:
```typescript
import express from 'express';
import { EmailAgent } from '../agents/email-agent';
import { ConversationMemory } from '../memory/conversation-memory';

const router = express.Router();
const emailAgent = new EmailAgent();
const memory = new ConversationMemory();

// Draft email
router.post('/email/draft', async (req, res) => {
  try {
    const { userId, recipient, purpose, context } = req.body;

    // Store user request in memory
    memory.addMessage(userId, 'user', `Draft email to ${recipient}: ${purpose}`);

    // Generate draft
    const draft = await emailAgent.composeEmail({ recipient, purpose, context });

    // Store draft in memory
    memory.addMessage(userId, 'assistant', JSON.stringify(draft));

    res.json({ success: true, draft });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send email (after approval)
router.post('/email/send', async (req, res) => {
  try {
    const { email } = req.body;
    await emailAgent.sendEmail(email);
    res.json({ success: true, message: 'Email sent!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation history
router.get('/memory/:userId', (req, res) => {
  const { userId } = req.params;
  const history = memory.getHistory(userId);
  res.json({ history });
});

export default router;
```

#### 5. Testing
Create `tests/email-agent.test.ts`:
```typescript
import { EmailAgent } from '../src/agents/email-agent';

describe('EmailAgent', () => {
  it('should compose an email', async () => {
    const agent = new EmailAgent();
    const draft = await agent.composeEmail({
      recipient: 'test@example.com',
      purpose: 'Welcome new user to the platform',
    });

    expect(draft.to).toBe('test@example.com');
    expect(draft.subject).toBeTruthy();
    expect(draft.body).toBeTruthy();
  });
});
```

### Example Usage
```bash
# Draft an email
curl -X POST http://localhost:3000/api/email/draft \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "recipient": "john@example.com",
    "purpose": "Invite to beta program",
    "context": "User has been active for 3 months"
  }'

# Response
{
  "success": true,
  "draft": {
    "to": "john@example.com",
    "subject": "Invite to beta program",
    "body": "Dear John,\n\nWe're excited to invite you..."
  }
}

# Send the email (after review)
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "email": {
      "to": "john@example.com",
      "subject": "Invite to beta program",
      "body": "Dear John,\n\nWe're excited..."
    }
  }'
```

### Deliverables
- ✅ Email agent working
- ✅ LLM integration functional
- ✅ Basic conversation memory
- ✅ API endpoints created
- ✅ Email sending via Resend
- ✅ Basic tests passing

### Success Criteria
- You can send a natural language request
- Agent drafts a relevant email
- You can review and approve
- Email sends successfully
- System remembers the conversation

---

## 📚 Phase 2: Knowledge Base + Custom RAG Pipeline
**Duration**: 2-3 weeks
**Goal**: Build custom RAG pipeline with Mistral OCR, ChonkieJS, and Pinecone

### What You'll Build
- Document extraction using Mistral OCR
- Text chunking with ChonkieJS
- Vector embeddings with OpenAI
- Pinecone for vector storage with hybrid search
- Complete custom RAG pipeline

### Tasks

#### 1. Install RAG Pipeline Dependencies
```bash
pnpm add @pinecone-database/pinecone
pnpm add @chonkiejs/core
pnpm add axios form-data
pnpm add openai
```

#### 2. Document Extraction Module
Create `src/rag/document-extractor.ts`:
```typescript
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export class DocumentExtractor {
  private mistralApiKey: string;

  constructor() {
    this.mistralApiKey = process.env.MISTRAL_API_KEY!;
  }

  async extractTextFromDocument(filePath: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    try {
      const response = await axios.post(
        'https://api.mistral.ai/v1/ocr',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.mistralApiKey}`,
            ...formData.getHeaders(),
          },
        }
      );

      return response.data.text;
    } catch (error) {
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }

  async extractTextFromMarkdown(filePath: string): Promise<string> {
    // For markdown files, just read directly
    return fs.promises.readFile(filePath, 'utf-8');
  }

  async extractText(filePath: string): Promise<string> {
    const ext = filePath.split('.').pop()?.toLowerCase();

    if (ext === 'md' || ext === 'txt') {
      return this.extractTextFromMarkdown(filePath);
    } else {
      // Use OCR for PDFs, images, etc.
      return this.extractTextFromDocument(filePath);
    }
  }
}
```

#### 3. Text Chunking with ChonkieJS
Create `src/rag/text-chunker.ts`:
```typescript
import { RecursiveChunker } from '@chonkiejs/core';

export class TextChunker {
  private chunker: RecursiveChunker;

  async initialize() {
    this.chunker = await RecursiveChunker.create({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  async chunkText(text: string): Promise<Array<{ text: string; tokenCount: number }>> {
    if (!this.chunker) {
      await this.initialize();
    }

    const chunks = await this.chunker.chunk(text);

    return chunks.map(chunk => ({
      text: chunk.text,
      tokenCount: chunk.tokenCount,
    }));
  }
}
```

#### 4. Embedding Generator
Create `src/rag/embedding-generator.ts`:
```typescript
import OpenAI from 'openai';

export class EmbeddingGenerator {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // OpenAI allows batch embedding generation
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: texts,
    });

    return response.data.map(item => item.embedding);
  }
}
```

#### 5. Complete Custom RAG Pipeline
Create `src/rag/custom-rag-pipeline.ts`:
```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { DocumentExtractor } from './document-extractor';
import { TextChunker } from './text-chunker';
import { EmbeddingGenerator } from './embedding-generator';

export class CustomRAGPipeline {
  private pinecone: Pinecone;
  private index: any;
  private docExtractor: DocumentExtractor;
  private chunker: TextChunker;
  private embedder: EmbeddingGenerator;

  constructor() {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    this.index = this.pinecone.index('coask-knowledge');
    this.docExtractor = new DocumentExtractor();
    this.chunker = new TextChunker();
    this.embedder = new EmbeddingGenerator();
  }

  async initialize() {
    await this.chunker.initialize();
  }

  // Ingest document into knowledge base
  async ingestDocument(filePath: string, metadata: any = {}) {
    console.log(`[RAG] Ingesting document: ${filePath}`);

    // 1. Extract text using Mistral OCR or direct read
    const text = await this.docExtractor.extractText(filePath);
    console.log(`[RAG] Extracted ${text.length} characters`);

    // 2. Chunk text using ChonkieJS
    const chunks = await this.chunker.chunkText(text);
    console.log(`[RAG] Created ${chunks.length} chunks`);

    // 3. Generate embeddings for all chunks (batch for efficiency)
    const chunkTexts = chunks.map(c => c.text);
    const embeddings = await this.embedder.generateBatchEmbeddings(chunkTexts);
    console.log(`[RAG] Generated ${embeddings.length} embeddings`);

    // 4. Upsert to Pinecone
    const vectors = chunks.map((chunk, i) => ({
      id: `${metadata.docId || 'doc'}_chunk_${i}`,
      values: embeddings[i],
      metadata: {
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        chunkIndex: i,
        totalChunks: chunks.length,
        source: filePath,
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    }));

    // Upsert in batches of 100 (Pinecone limit)
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await this.index.upsert(batch);
    }

    console.log(`[RAG] Successfully ingested ${chunks.length} chunks to Pinecone`);

    return {
      success: true,
      chunksCreated: chunks.length,
      charactersProcessed: text.length,
    };
  }

  // Query knowledge base with hybrid search
  async query(question: string, options: {
    topK?: number;
    filter?: any;
  } = {}): Promise<{ context: string; sources: any[] }> {
    const topK = options.topK || 5;

    // 1. Generate query embedding
    const queryEmbedding = await this.embedder.generateEmbedding(question);

    // 2. Hybrid search (vector + keyword via Pinecone)
    const searchResults = await this.index.query({
      vector: queryEmbedding,
      topK,
      filter: options.filter,
      includeMetadata: true,
    });

    // 3. Format context for LLM
    const context = searchResults.matches
      .map((match: any, i: number) => {
        const relevance = (match.score * 100).toFixed(1);
        return `[Document ${i + 1}] (Relevance: ${relevance}%)\n${match.metadata?.text}`;
      })
      .join('\n\n---\n\n');

    // 4. Return context and sources
    const sources = searchResults.matches.map((match: any) => ({
      source: match.metadata?.source,
      chunkIndex: match.metadata?.chunkIndex,
      relevance: match.score,
    }));

    return { context, sources };
  }

  // Query with specific category filter
  async queryByCategory(question: string, category: string, topK: number = 5) {
    return this.query(question, {
      topK,
      filter: { category: { $eq: category } },
    });
  }
}
```

#### 6. Knowledge Agent (Using Custom RAG)
Create `src/agents/knowledge-agent.ts`:
```typescript
import { CustomRAGPipeline } from '../rag/custom-rag-pipeline';
import { callLLM } from '../core/llm';

export class KnowledgeAgent {
  private rag: CustomRAGPipeline;

  constructor() {
    this.rag = new CustomRAGPipeline();
  }

  async initialize() {
    await this.rag.initialize();
  }

  async retrieveContext(query: string, topK: number = 5): Promise<string> {
    const { context } = await this.rag.query(query, { topK });
    return context;
  }

  async retrieveContextWithSources(query: string, topK: number = 5) {
    return await this.rag.query(query, { topK });
  }

  async answerQuestion(question: string): Promise<string> {
    // Retrieve relevant context with sources
    const { context, sources } = await this.rag.query(question, { topK: 5 });

    // Generate answer using context
    const prompt = `
      Based on the following context from our knowledge base, answer the question.

      Context:
      ${context}

      Question: ${question}

      Provide a clear, accurate answer based solely on the context above.
      If the context doesn't contain enough information, say so.

      Answer:
    `;

    const answer = await callLLM(prompt, 'You are a knowledgeable assistant.');

    return answer;
  }

  async queryByCategory(question: string, category: string): Promise<string> {
    const { context } = await this.rag.queryByCategory(question, category);
    return context;
  }
}
```

#### 4. Enhanced Email Agent with Knowledge
Update `src/agents/email-agent.ts`:
```typescript
import { KnowledgeAgent } from './knowledge-agent';

export class EmailAgent {
  private knowledgeAgent: KnowledgeAgent;

  constructor() {
    this.knowledgeAgent = new KnowledgeAgent();
  }

  async composeEmailWithContext(request: {
    recipient: string;
    purpose: string;
    useKnowledge: boolean;
  }) {
    let context = '';

    if (request.useKnowledge) {
      // Retrieve relevant knowledge
      context = await this.knowledgeAgent.retrieveContext(request.purpose);
    }

    const prompt = `
      Compose a professional email:

      Recipient: ${request.recipient}
      Purpose: ${request.purpose}

      ${context ? `Use this information:\n${context}` : ''}

      Write the email body:
    `;

    const body = await callLLM(prompt, 'You are a professional email writer.');

    return {
      to: request.recipient,
      subject: this.generateSubject(request.purpose),
      body,
    };
  }

  // ... rest of the methods
}
```

#### 7. Knowledge Management API
Create `src/routes/knowledge-routes.ts`:
```typescript
import express from 'express';
import multer from 'multer';
import { CustomRAGPipeline } from '../rag/custom-rag-pipeline';
import { KnowledgeAgent } from '../agents/knowledge-agent';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const rag = new CustomRAGPipeline();
const knowledgeAgent = new KnowledgeAgent();

// Initialize on startup
rag.initialize();
knowledgeAgent.initialize();

// Upload and ingest document file (PDF, image, etc.)
router.post('/knowledge/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { category, docId } = req.body;

    const result = await rag.ingestDocument(req.file.path, {
      category,
      docId: docId || req.file.filename,
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ingest text directly
router.post('/knowledge/ingest-text', async (req, res) => {
  try {
    const { text, category, docId } = req.body;

    // Write to temp file
    const tempPath = `/tmp/${docId || Date.now()}.txt`;
    fs.writeFileSync(tempPath, text);

    const result = await rag.ingestDocument(tempPath, {
      category,
      docId,
    });

    // Clean up
    fs.unlinkSync(tempPath);

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search knowledge base
router.post('/knowledge/search', async (req, res) => {
  try {
    const { query, topK, category } = req.body;

    let result;
    if (category) {
      result = await rag.queryByCategory(query, category, topK);
    } else {
      result = await rag.query(query, { topK });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ask a question (includes LLM answer generation)
router.post('/knowledge/ask', async (req, res) => {
  try {
    const { question } = req.body;
    const answer = await knowledgeAgent.answerQuestion(question);
    res.json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

#### 8. Seed Knowledge Base
Create `scripts/seed-knowledge.ts`:
```typescript
import { CustomRAGPipeline } from '../src/rag/custom-rag-pipeline';
import fs from 'fs';
import path from 'path';

async function seedKnowledge() {
  const rag = new CustomRAGPipeline();
  await rag.initialize();

  // Create temp directory
  const tempDir = './temp_knowledge';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // Example 1: Company information
  const companyInfo = `
# About Our Company

We build AI-powered automation tools for businesses.
Our mission is to make AI accessible to everyone through intelligent automation.

# Products

1. Coask - Personal AI automation platform
   - Multi-agent system for complex workflows
   - Email automation and personalization
   - Smart scheduling and calendar management
   - Knowledge base with RAG

2. Email Assistant - Intelligent email management
3. Calendar AI - Smart scheduling

# Tone of Voice

- Professional but friendly
- Clear and concise
- Helpful and supportive
- Solution-oriented

# Values

- Innovation
- Accessibility
- Privacy & Security
- User Empowerment
  `;

  const companyPath = path.join(tempDir, 'company.md');
  fs.writeFileSync(companyPath, companyInfo);
  await rag.ingestDocument(companyPath, {
    docId: 'company_info',
    category: 'company',
  });
  console.log('✅ Ingested company info');

  // Example 2: Pricing information
  const pricingInfo = `
# Pricing Tiers

## Basic Plan - $10/month
- 100 tasks per month
- 1 AI agent
- Email integration
- Community support

## Pro Plan - $50/month
- Unlimited tasks
- All AI agents
- Priority support
- Advanced integrations
- Custom workflows

## Enterprise Plan - Custom pricing
- Volume discounts
- On-premise deployment
- Dedicated support
- SLA guarantees
- White-label option
  `;

  const pricingPath = path.join(tempDir, 'pricing.md');
  fs.writeFileSync(pricingPath, pricingInfo);
  await rag.ingestDocument(pricingPath, {
    docId: 'pricing',
    category: 'pricing',
  });
  console.log('✅ Ingested pricing info');

  // Example 3: Email templates
  const emailTemplates = `
# Email Templates

## Welcome Email Template
Subject: Welcome to Coask!

Hi {name},

Welcome to Coask! We're excited to have you on board.

Coask is your personal AI automation platform. Here's what you can do:
- Automate email campaigns
- Schedule recurring tasks
- Build knowledge bases
- Connect to your favorite tools

Get started: {dashboard_url}

Best,
The Coask Team

## Product Update Template
Subject: New Feature: {feature_name}

Hi {name},

We've just released {feature_name}! This helps you {benefit}.

Try it out: {feature_url}

Questions? Reply to this email.

Cheers,
{sender_name}
  `;

  const templatesPath = path.join(tempDir, 'email_templates.md');
  fs.writeFileSync(templatesPath, emailTemplates);
  await rag.ingestDocument(templatesPath, {
    docId: 'email_templates',
    category: 'email_templates',
  });
  console.log('✅ Ingested email templates');

  // Clean up
  fs.rmSync(tempDir, { recursive: true });

  console.log('\n🎉 Knowledge base seeded successfully!');
  console.log('Total documents: 3');
}

seedKnowledge().catch(console.error);
```

### Example Usage
```bash
# 1. Seed the knowledge base
pnpm run seed-knowledge

# 2. Upload a PDF document
curl -X POST http://localhost:3000/api/knowledge/upload \
  -F "file=@./docs/product_guide.pdf" \
  -F "category=documentation" \
  -F "docId=product_guide_v2"

# 3. Ingest text directly
curl -X POST http://localhost:3000/api/knowledge/ingest-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Our product pricing: Basic $10/mo, Pro $50/mo, Enterprise custom",
    "category": "pricing",
    "docId": "pricing_2025"
  }'

# 4. Search knowledge base
curl -X POST http://localhost:3000/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the pricing tiers?",
    "topK": 5
  }'

# Response includes context and sources:
{
  "context": "[Document 1] (Relevance: 94.2%)\n# Pricing Tiers\n\n## Basic Plan - $10/month...",
  "sources": [
    { "source": "./temp_knowledge/pricing.md", "chunkIndex": 0, "relevance": 0.942 }
  ]
}

# 5. Ask a question (gets LLM-generated answer)
curl -X POST http://localhost:3000/api/knowledge/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What features are included in the Pro plan?"
  }'

# 6. Draft email using knowledge base
curl -X POST http://localhost:3000/api/email/draft \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "customer@example.com",
    "purpose": "Explain our pricing options",
    "useKnowledge": true
  }'

# The email agent will automatically:
# 1. Query knowledge base for pricing info
# 2. Use retrieved context to draft personalized email
# 3. Return draft for your approval
```

### Deliverables
- ✅ Custom RAG pipeline implemented
- ✅ Mistral OCR integration working
- ✅ ChonkieJS chunking functional
- ✅ OpenAI embeddings generating
- ✅ Pinecone vector storage connected
- ✅ Hybrid search operational
- ✅ Knowledge Agent using RAG
- ✅ Document ingestion pipeline complete
- ✅ Knowledge management API with file uploads
- ✅ Seeded knowledge base
- ✅ Email agent enhanced with knowledge retrieval

### Success Criteria
- ✅ PDF/image documents extracted correctly via Mistral OCR
- ✅ Text chunked efficiently with proper overlap
- ✅ Embeddings generated and stored in Pinecone
- ✅ Hybrid search returns relevant results (>85% accuracy)
- ✅ Knowledge Agent retrieves accurate context
- ✅ Email agent uses knowledge base effectively
- ✅ Query latency < 2 seconds
- ✅ Can filter by category/metadata
- ✅ Sources are tracked for transparency

---

## 🤝 Phase 3: Multi-Agent System
**Duration**: 3-4 weeks
**Goal**: Build coordinated multi-agent workflows with LangGraph

### What You'll Build
- Multiple specialized agents (Email, Calendar, Research, Reporting)
- Agent orchestration with LangGraph
- Inter-agent communication
- Complex multi-step workflows

### Tasks

#### 1. Setup LangGraph
```bash
pnpm add @langchain/langgraph @langchain/core
```

#### 2. Define Agent Interfaces
Create `src/agents/base-agent.ts`:
```typescript
export interface AgentContext {
  userId: string;
  taskId: string;
  memory: any;
  previousResults?: Map<string, any>;
}

export interface AgentResult {
  success: boolean;
  data: any;
  error?: string;
  nextAgent?: string;
}

export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;

  abstract execute(context: AgentContext, input: any): Promise<AgentResult>;

  protected log(message: string) {
    console.log(`[${this.name}] ${message}`);
  }
}
```

#### 3. Create Specialized Agents

**Research Agent** (`src/agents/research-agent.ts`):
```typescript
import axios from 'axios';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';

export class ResearchAgent extends BaseAgent {
  name = 'ResearchAgent';
  description = 'Fetches data from APIs and external sources';

  async execute(context: AgentContext, input: { apiUrl: string; params?: any }): Promise<AgentResult> {
    this.log(`Fetching data from ${input.apiUrl}`);

    try {
      const response = await axios.get(input.apiUrl, {
        params: input.params,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }
}
```

**Calendar Agent** (`src/agents/calendar-agent.ts`):
```typescript
import { google } from 'googleapis';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';

export class CalendarAgent extends BaseAgent {
  name = 'CalendarAgent';
  description = 'Manages calendar events and reminders';

  async execute(context: AgentContext, input: {
    action: 'create' | 'list' | 'remind';
    event?: any;
  }): Promise<AgentResult> {
    this.log(`Calendar action: ${input.action}`);

    // Simplified example
    if (input.action === 'create' && input.event) {
      // Create calendar event
      return {
        success: true,
        data: { eventId: 'evt_123', created: true },
      };
    }

    return {
      success: false,
      data: null,
      error: 'Unsupported action',
    };
  }
}
```

**Reporting Agent** (`src/agents/reporting-agent.ts`):
```typescript
import { BaseAgent, AgentContext, AgentResult } from './base-agent';

export class ReportingAgent extends BaseAgent {
  name = 'ReportingAgent';
  description = 'Generates reports and summaries';

  async execute(context: AgentContext, input: { data: any }): Promise<AgentResult> {
    this.log('Generating report');

    // Simple summary generation
    const summary = this.generateSummary(input.data);

    return {
      success: true,
      data: { summary },
    };
  }

  private generateSummary(data: any): string {
    // Use LLM to generate summary
    return `Summary of ${JSON.stringify(data).slice(0, 100)}...`;
  }
}
```

#### 4. Agent Orchestrator with LangGraph
Create `src/orchestration/multi-agent-workflow.ts`:
```typescript
import { StateGraph } from '@langchain/langgraph';
import { EmailAgent } from '../agents/email-agent';
import { ResearchAgent } from '../agents/research-agent';
import { KnowledgeAgent } from '../agents/knowledge-agent';
import { ReportingAgent } from '../agents/reporting-agent';

export interface WorkflowState {
  userId: string;
  task: string;
  researchData?: any;
  knowledge?: any;
  emailDraft?: any;
  report?: any;
  currentStep: string;
}

export class MultiAgentWorkflow {
  private emailAgent: EmailAgent;
  private researchAgent: ResearchAgent;
  private knowledgeAgent: KnowledgeAgent;
  private reportingAgent: ReportingAgent;

  constructor() {
    this.emailAgent = new EmailAgent();
    this.researchAgent = new ResearchAgent();
    this.knowledgeAgent = new KnowledgeAgent();
    this.reportingAgent = new ReportingAgent();
  }

  async executeEmailCampaign(request: {
    userId: string;
    apiUrl: string;
    emailPurpose: string;
  }) {
    // Define workflow
    const workflow = new StateGraph<WorkflowState>({
      channels: {
        userId: null,
        task: null,
        researchData: null,
        knowledge: null,
        emailDraft: null,
        report: null,
        currentStep: null,
      },
    });

    // Step 1: Research - Get users from API
    workflow.addNode('research', async (state) => {
      const result = await this.researchAgent.execute(
        { userId: state.userId, taskId: 'task_1', memory: null },
        { apiUrl: request.apiUrl }
      );

      return {
        ...state,
        researchData: result.data,
        currentStep: 'knowledge',
      };
    });

    // Step 2: Knowledge - Get email template/info
    workflow.addNode('knowledge', async (state) => {
      const context = await this.knowledgeAgent.retrieveContext(request.emailPurpose);

      return {
        ...state,
        knowledge: context,
        currentStep: 'email',
      };
    });

    // Step 3: Email - Draft emails
    workflow.addNode('email', async (state) => {
      // Draft email using research data and knowledge
      const draft = await this.emailAgent.composeEmailWithContext({
        recipient: 'users@example.com', // would loop through users
        purpose: request.emailPurpose,
        useKnowledge: true,
      });

      return {
        ...state,
        emailDraft: draft,
        currentStep: 'report',
      };
    });

    // Step 4: Report - Summarize
    workflow.addNode('report', async (state) => {
      const result = await this.reportingAgent.execute(
        { userId: state.userId, taskId: 'task_1', memory: null },
        { data: { users: state.researchData, email: state.emailDraft } }
      );

      return {
        ...state,
        report: result.data,
        currentStep: 'done',
      };
    });

    // Define edges (flow)
    workflow.addEdge('research', 'knowledge');
    workflow.addEdge('knowledge', 'email');
    workflow.addEdge('email', 'report');
    workflow.setEntryPoint('research');

    // Compile and run
    const app = workflow.compile();

    const initialState: WorkflowState = {
      userId: request.userId,
      task: 'email_campaign',
      currentStep: 'research',
    };

    const result = await app.invoke(initialState);
    return result;
  }
}
```

#### 5. Workflow API
Create `src/routes/workflow-routes.ts`:
```typescript
import express from 'express';
import { MultiAgentWorkflow } from '../orchestration/multi-agent-workflow';

const router = express.Router();
const workflow = new MultiAgentWorkflow();

router.post('/workflow/email-campaign', async (req, res) => {
  const { userId, apiUrl, emailPurpose } = req.body;

  try {
    const result = await workflow.executeEmailCampaign({
      userId,
      apiUrl,
      emailPurpose,
    });

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

#### 6. Testing Multi-Agent Workflows
```typescript
describe('Multi-Agent Workflow', () => {
  it('should execute email campaign workflow', async () => {
    const workflow = new MultiAgentWorkflow();

    const result = await workflow.executeEmailCampaign({
      userId: 'user123',
      apiUrl: 'https://api.example.com/users',
      emailPurpose: 'onboarding',
    });

    expect(result.currentStep).toBe('done');
    expect(result.emailDraft).toBeDefined();
    expect(result.report).toBeDefined();
  });
});
```

### Example Usage
```bash
# Execute multi-agent workflow
curl -X POST http://localhost:3000/api/workflow/email-campaign \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "apiUrl": "https://jsonplaceholder.typicode.com/users",
    "emailPurpose": "Welcome new users to our platform"
  }'

# Response
{
  "success": true,
  "result": {
    "userId": "user123",
    "task": "email_campaign",
    "researchData": [...],  // Users from API
    "knowledge": "...",     // Relevant knowledge
    "emailDraft": {...},    // Generated email
    "report": {...},        // Summary report
    "currentStep": "done"
  }
}
```

### Deliverables
- ✅ Multiple specialized agents
- ✅ LangGraph orchestration working
- ✅ Sequential workflows functional
- ✅ Inter-agent communication
- ✅ Complex multi-step tasks completed
- ✅ Workflow API endpoints

### Success Criteria
- Agents execute in correct order
- Data flows between agents
- Errors handled gracefully
- Full workflow completes successfully
- Results are coherent and useful

---

## ⏰ Phase 4: Scheduling & Automation
**Duration**: 2-3 weeks
**Goal**: Add job scheduling for recurring automated tasks

### What You'll Build
- BullMQ job queue
- Cron scheduling
- Recurring task management
- Job monitoring dashboard

### Tasks

#### 1. Setup BullMQ
```bash
pnpm add bullmq ioredis
pnpm add @bull-board/api @bull-board/express
```

#### 2. Job Queue Setup
Create `src/queue/queue-manager.ts`:
```typescript
import { Queue, Worker, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL);

export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();

  createQueue(name: string) {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, { connection });
    this.queues.set(name, queue);
    return queue;
  }

  createWorker(name: string, processor: (job: any) => Promise<any>) {
    const worker = new Worker(name, processor, { connection });

    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    this.workers.set(name, worker);
    return worker;
  }

  getQueue(name: string) {
    return this.queues.get(name);
  }
}

export const queueManager = new QueueManager();
```

#### 3. Email Campaign Scheduler
Create `src/queue/jobs/email-campaign-job.ts`:
```typescript
import { queueManager } from '../queue-manager';
import { MultiAgentWorkflow } from '../../orchestration/multi-agent-workflow';

const QUEUE_NAME = 'email-campaigns';

export class EmailCampaignScheduler {
  private queue;
  private workflow: MultiAgentWorkflow;

  constructor() {
    this.queue = queueManager.createQueue(QUEUE_NAME);
    this.workflow = new MultiAgentWorkflow();

    // Create worker
    queueManager.createWorker(QUEUE_NAME, this.processJob.bind(this));
  }

  async scheduleRecurring(config: {
    userId: string;
    apiUrl: string;
    emailPurpose: string;
    cronExpression: string;  // e.g., "0 9 * * *" for daily at 9 AM
  }) {
    await this.queue.add(
      'recurring-campaign',
      config,
      {
        repeat: {
          pattern: config.cronExpression,
        },
      }
    );

    return { scheduled: true, cron: config.cronExpression };
  }

  async scheduleOneTime(config: {
    userId: string;
    apiUrl: string;
    emailPurpose: string;
    sendAt: Date;
  }) {
    const delay = config.sendAt.getTime() - Date.now();

    await this.queue.add(
      'one-time-campaign',
      config,
      {
        delay,
      }
    );

    return { scheduled: true, sendAt: config.sendAt };
  }

  private async processJob(job: any) {
    console.log(`Processing job ${job.id}`, job.data);

    const result = await this.workflow.executeEmailCampaign({
      userId: job.data.userId,
      apiUrl: job.data.apiUrl,
      emailPurpose: job.data.emailPurpose,
    });

    return result;
  }

  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state: await job.getState(),
      progress: job.progress,
      returnvalue: job.returnvalue,
    };
  }

  async listJobs() {
    const [active, waiting, completed, failed] = await Promise.all([
      this.queue.getActive(),
      this.queue.getWaiting(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
    ]);

    return { active, waiting, completed, failed };
  }
}
```

#### 4. Bull Board (Monitoring UI)
Create `src/queue/bull-board.ts`:
```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { queueManager } from './queue-manager';

export function setupBullBoard() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queues = Array.from(queueManager['queues'].values());

  createBullBoard({
    queues: queues.map(q => new BullMQAdapter(q)),
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
```

Add to `src/index.ts`:
```typescript
import { setupBullBoard } from './queue/bull-board';

// ... existing code ...

app.use('/admin/queues', setupBullBoard());
```

#### 5. Scheduling API
Create `src/routes/schedule-routes.ts`:
```typescript
import express from 'express';
import { EmailCampaignScheduler } from '../queue/jobs/email-campaign-job';

const router = express.Router();
const scheduler = new EmailCampaignScheduler();

// Schedule recurring campaign
router.post('/schedule/recurring', async (req, res) => {
  const { userId, apiUrl, emailPurpose, cronExpression } = req.body;

  const result = await scheduler.scheduleRecurring({
    userId,
    apiUrl,
    emailPurpose,
    cronExpression,
  });

  res.json(result);
});

// Schedule one-time campaign
router.post('/schedule/once', async (req, res) => {
  const { userId, apiUrl, emailPurpose, sendAt } = req.body;

  const result = await scheduler.scheduleOneTime({
    userId,
    apiUrl,
    emailPurpose,
    sendAt: new Date(sendAt),
  });

  res.json(result);
});

// Get job status
router.get('/schedule/job/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const status = await scheduler.getJobStatus(jobId);
  res.json(status);
});

// List all jobs
router.get('/schedule/jobs', async (req, res) => {
  const jobs = await scheduler.listJobs();
  res.json(jobs);
});

export default router;
```

#### 6. Cron Expression Helper
Create `src/utils/cron-helper.ts`:
```typescript
export const CRON_PRESETS = {
  EVERY_MINUTE: '* * * * *',
  HOURLY: '0 * * * *',
  DAILY_9AM: '0 9 * * *',
  EVERY_3_DAYS: '0 9 */3 * *',
  WEEKLY_MONDAY: '0 9 * * MON',
  MONTHLY_1ST: '0 9 1 * *',
};

export function parseCronExpression(expression: string): {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
} {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = expression.split(' ');
  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

export function describeCron(expression: string): string {
  // Simple descriptions (can use a library for complex ones)
  if (expression === CRON_PRESETS.DAILY_9AM) return 'Every day at 9:00 AM';
  if (expression === CRON_PRESETS.WEEKLY_MONDAY) return 'Every Monday at 9:00 AM';
  if (expression === CRON_PRESETS.EVERY_3_DAYS) return 'Every 3 days at 9:00 AM';
  return 'Custom schedule';
}
```

### Example Usage
```bash
# Schedule recurring email campaign (every 3 days)
curl -X POST http://localhost:3000/api/schedule/recurring \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "apiUrl": "https://api.example.com/users",
    "emailPurpose": "Weekly newsletter",
    "cronExpression": "0 9 */3 * *"
  }'

# Response
{
  "scheduled": true,
  "cron": "0 9 */3 * *"
}

# Check job status
curl http://localhost:3000/api/schedule/jobs

# View monitoring UI
# Open http://localhost:3000/admin/queues in browser
```

### Deliverables
- ✅ BullMQ job queue running
- ✅ Cron scheduling working
- ✅ Recurring tasks executing
- ✅ Bull Board monitoring UI
- ✅ Job management API
- ✅ Error handling and retries

### Success Criteria
- Jobs execute on schedule
- Failed jobs retry automatically
- Can view job status in real-time
- Recurring jobs continue indefinitely
- Can pause/resume/delete jobs

---

## 🔌 Phase 5: Integrations & Polish
**Duration**: 2-4 weeks
**Goal**: Add remaining integrations and build user interface

### What You'll Build
- Google Calendar integration
- Gmail integration
- CSV upload support
- Web UI for managing tasks
- User authentication

### Tasks

#### 1. Google Calendar Integration
Create `src/integrations/google-calendar.ts`:
```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class GoogleCalendarIntegration {
  private oauth2Client: OAuth2Client;
  private calendar;

  constructor(credentials: { accessToken: string; refreshToken: string }) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async createEvent(event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: string[];
  }) {
    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.summary,
        description: event.description,
        start: {
          dateTime: event.start.toISOString(),
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: event.end.toISOString(),
          timeZone: 'America/New_York',
        },
        attendees: event.attendees?.map(email => ({ email })),
      },
    });

    return response.data;
  }

  async listEvents(maxResults: number = 10) {
    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items;
  }
}
```

#### 2. Gmail Integration
Create `src/integrations/gmail.ts`:
```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class GmailIntegration {
  private oauth2Client: OAuth2Client;
  private gmail;

  constructor(credentials: { accessToken: string; refreshToken: string }) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  async sendEmail(email: {
    to: string;
    subject: string;
    body: string;
  }) {
    const raw = this.createEmail(email);

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
      },
    });

    return response.data;
  }

  private createEmail(email: { to: string; subject: string; body: string }): string {
    const message = [
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      '',
      email.body,
    ].join('\n');

    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  async searchEmails(query: string, maxResults: number = 10) {
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    return response.data.messages || [];
  }
}
```

#### 3. CSV Upload & Processing
```bash
pnpm add csv-parser multer
```

Create `src/utils/csv-processor.ts`:
```typescript
import csv from 'csv-parser';
import fs from 'fs';

export async function processCSV(filePath: string): Promise<any[]> {
  const results: any[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}
```

Add upload endpoint:
```typescript
import multer from 'multer';
import { processCSV } from '../utils/csv-processor';

const upload = multer({ dest: 'uploads/' });

router.post('/upload/csv', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const data = await processCSV(req.file.path);

  // Clean up
  fs.unlinkSync(req.file.path);

  res.json({ success: true, rowCount: data.length, data });
});
```

#### 4. User Authentication (Simple JWT)
```bash
pnpm add jsonwebtoken bcryptjs
pnpm add -D @types/jsonwebtoken @types/bcryptjs
```

Create `src/auth/auth-service.ts`:
```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../core/prisma';

export class AuthService {
  async register(email: string, password: string, name: string) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return this.generateToken(user.id, user.email);
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      throw new Error('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      throw new Error('Invalid credentials');
    }

    return this.generateToken(user.id, user.email);
  }

  private generateToken(userId: string, email: string) {
    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return { token, userId, email };
  }

  verifyToken(token: string) {
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };
  }
}
```

#### 5. Frontend (Next.js)
```bash
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend
pnpm add axios zustand
```

Create simple dashboard (`frontend/app/page.tsx`):
```typescript
'use client';

import { useState } from 'react';
import axios from 'axios';

export default function Dashboard() {
  const [recipient, setRecipient] = useState('');
  const [purpose, setPurpose] = useState('');
  const [draft, setDraft] = useState<any>(null);

  const handleDraft = async () => {
    const response = await axios.post('http://localhost:3000/api/email/draft', {
      userId: 'user123',
      recipient,
      purpose,
      useKnowledge: true,
    });

    setDraft(response.data.draft);
  };

  const handleSend = async () => {
    await axios.post('http://localhost:3000/api/email/send', {
      email: draft,
    });

    alert('Email sent!');
    setDraft(null);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">AI Email Assistant</h1>

      <div className="space-y-4">
        <input
          type="email"
          placeholder="Recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="w-full p-2 border rounded"
        />

        <textarea
          placeholder="What do you want to say?"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className="w-full p-2 border rounded h-24"
        />

        <button
          onClick={handleDraft}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Draft Email
        </button>

        {draft && (
          <div className="border p-4 rounded">
            <h2 className="font-bold">Draft Preview</h2>
            <p><strong>To:</strong> {draft.to}</p>
            <p><strong>Subject:</strong> {draft.subject}</p>
            <div className="mt-2 whitespace-pre-wrap">{draft.body}</div>

            <button
              onClick={handleSend}
              className="bg-green-500 text-white px-4 py-2 rounded mt-4"
            >
              Send Email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Deliverables
- ✅ Google Calendar integration
- ✅ Gmail integration
- ✅ CSV upload support
- ✅ User authentication
- ✅ Basic web UI
- ✅ Integration testing

### Success Criteria
- Can create calendar events
- Can send emails via Gmail
- Can upload and process CSV files
- Users can log in securely
- UI is functional and intuitive

---

## 🚀 Phase 6: Production & Scale
**Duration**: Ongoing
**Goal**: Deploy, monitor, optimize, and scale

### What You'll Build
- Production deployment
- Monitoring and alerting
- Performance optimization
- Security hardening
- User feedback loop

### Tasks

#### 1. Production Deployment (Railway)
Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100
  }
}
```

Add build command to `package.json`:
```json
{
  "scripts": {
    "build": "prisma generate && tsc",
    "start": "node dist/index.js"
  }
}
```

Deploy:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

#### 2. Environment Management
Create `.env.production`:
```bash
NODE_ENV=production
DATABASE_URL=${DATABASE_URL}  # Railway provides this
REDIS_URL=${REDIS_URL}        # Railway provides this
...
```

#### 3. Monitoring Setup

**Sentry for Error Tracking**:
```bash
pnpm add @sentry/node
```

Add to `src/index.ts`:
```typescript
import * as Sentry from '@sentry/node';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}
```

**Winston for Logging**:
```typescript
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

#### 4. Performance Optimization

**Database Indexing**:
```prisma
model Task {
  id        String   @id @default(uuid())
  userId    String
  status    String
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}
```

**Caching Strategy**:
```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached);
  }

  const data = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(data));

  return data;
}
```

**Rate Limiting**:
```bash
pnpm add express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

#### 5. Security Hardening

**Helmet for HTTP Headers**:
```bash
pnpm add helmet
```

```typescript
import helmet from 'helmet';
app.use(helmet());
```

**CORS Configuration**:
```bash
pnpm add cors
```

```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
}));
```

**Secrets Management**:
```typescript
// Encrypt sensitive data before storing
import crypto from 'crypto';

function encrypt(text: string): string {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY!);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encrypted: string): string {
  const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY!);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

#### 6. Backup & Recovery
```bash
# Database backups (daily cron job)
0 2 * * * pg_dump $DATABASE_URL > backup_$(date +\%Y\%m\%d).sql
```

#### 7. Analytics & Metrics
Track key metrics:
- Number of tasks executed
- Success/failure rates
- Agent performance (latency, accuracy)
- User engagement
- API usage

Create `src/analytics/metrics.ts`:
```typescript
import { prisma } from '../core/prisma';

export class MetricsCollector {
  async recordTaskExecution(taskId: string, agent: string, success: boolean, duration: number) {
    await prisma.metric.create({
      data: {
        taskId,
        agent,
        success,
        duration,
        timestamp: new Date(),
      },
    });
  }

  async getMetrics(startDate: Date, endDate: Date) {
    const metrics = await prisma.metric.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return {
      totalTasks: metrics.length,
      successRate: metrics.filter(m => m.success).length / metrics.length,
      avgDuration: metrics.reduce((acc, m) => acc + m.duration, 0) / metrics.length,
      byAgent: this.groupByAgent(metrics),
    };
  }

  private groupByAgent(metrics: any[]) {
    const grouped: any = {};
    metrics.forEach(m => {
      if (!grouped[m.agent]) {
        grouped[m.agent] = { total: 0, success: 0, failures: 0 };
      }
      grouped[m.agent].total++;
      if (m.success) {
        grouped[m.agent].success++;
      } else {
        grouped[m.agent].failures++;
      }
    });
    return grouped;
  }
}
```

### Deliverables
- ✅ Production deployment
- ✅ Monitoring and alerts
- ✅ Performance optimizations
- ✅ Security hardening
- ✅ Backup system
- ✅ Analytics dashboard

### Success Criteria
- System runs reliably 24/7
- Errors are caught and reported
- Performance meets SLAs
- Data is secure and backed up
- You can track user behavior and system health

---

## 📊 Progress Tracking

Create a simple checklist to track implementation:

### Phase 0: Setup ☑️
- [ ] Project initialized
- [ ] TypeScript configured
- [ ] Database connected
- [ ] Git repository set up

### Phase 1: Single Agent ☑️
- [ ] LLM integration working
- [ ] Email agent functional
- [ ] Basic memory implemented
- [ ] API endpoints created

### Phase 2: Knowledge Base ☑️
- [ ] Vector database integrated
- [ ] RAG system working
- [ ] Knowledge retrieval functional
- [ ] Documents ingested

### Phase 3: Multi-Agent ☑️
- [ ] Multiple agents created
- [ ] LangGraph orchestration working
- [ ] Workflows executing correctly
- [ ] Inter-agent communication functional

### Phase 4: Scheduling ☑️
- [ ] BullMQ configured
- [ ] Cron jobs working
- [ ] Recurring tasks executing
- [ ] Monitoring UI accessible

### Phase 5: Integrations ☑️
- [ ] Google Calendar working
- [ ] Gmail integration functional
- [ ] CSV uploads working
- [ ] Web UI deployed

### Phase 6: Production ☑️
- [ ] Deployed to production
- [ ] Monitoring set up
- [ ] Performance optimized
- [ ] Security hardened

---

## 🎯 Next Steps

1. **Start with Phase 0** - Don't skip the foundation
2. **Build incrementally** - Test each phase before moving on
3. **Get feedback early** - Share prototypes with users
4. **Document as you go** - Update docs with learnings
5. **Iterate** - Refine based on real usage

---

## 📚 Additional Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [BullMQ Guide](https://docs.bullmq.io/)
- [Pinecone Quickstart](https://docs.pinecone.io/docs/quickstart)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Remember**: This is a living roadmap. Adjust based on your specific needs, user feedback, and new technologies that emerge. The goal is to build something useful, not to follow a rigid plan.

Good luck! 🚀
