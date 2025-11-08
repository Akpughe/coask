# Coask Source Code

## Directory Structure

```
src/
├── agents/          # AI agents (Phase 1+)
├── core/
│   ├── config.ts    # Configuration management
│   └── database.ts  # Prisma database client
├── integrations/    # External API integrations (Phase 5)
├── memory/          # Memory systems (Phase 2)
├── queue/           # Job queue and scheduling (Phase 4)
├── rag/             # RAG pipeline (Phase 2)
├── routes/
│   └── health.ts    # Health check endpoints
├── utils/
│   └── logger.ts    # Logging utility
└── index.ts         # Main application entry point
```

## Current Phase: Phase 2 ✅

**Status**: Knowledge Base + Custom RAG Pipeline Complete

### What's Implemented:
- ✅ TypeScript configuration
- ✅ Express server with health checks
- ✅ Environment configuration
- ✅ Logging utility
- ✅ Prisma ORM setup
- ✅ LLM client wrapper (OpenAI & Anthropic)
- ✅ In-memory conversation store
- ✅ Email Agent with drafting and reply capabilities
- ✅ Custom RAG Pipeline (Mistral OCR + ChonkieJS + OpenAI Embeddings + Pinecone)
- ✅ Document extractor (PDF, images, text)
- ✅ Text chunker with multiple strategies
- ✅ Embedding generator (OpenAI ada-002)
- ✅ Vector store (Pinecone with hybrid search)
- ✅ Knowledge base API endpoints

### Available Endpoints:

**Health Checks:**
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check

**Email Agent:**
- `POST /agents/email/draft` - Draft a new email
- `POST /agents/email/reply` - Generate email reply
- `GET /agents/email/stats` - Get agent statistics
- `GET /agents/email/conversations/:userId` - Get user conversations
- `DELETE /agents/email/history/:userId` - Clear conversation history

**Knowledge Base:**
- `POST /knowledge/ingest/file` - Ingest document from file upload
- `POST /knowledge/ingest/url` - Ingest document from URL
- `POST /knowledge/ingest/text` - Ingest plain text
- `POST /knowledge/query` - Query the knowledge base
- `DELETE /knowledge/document/:docId` - Delete a document
- `GET /knowledge/stats` - Get knowledge base statistics
- `GET /knowledge/health` - Check knowledge base health

### Development Commands:
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run production server
pnpm start
```

### Required API Keys:

**For Email Agent:**
```bash
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
```

**For Knowledge Base (RAG Pipeline):**
```bash
OPENAI_API_KEY=sk-...           # For embeddings
PINECONE_API_KEY=...            # For vector storage
MISTRAL_API_KEY=...             # For OCR (optional, for PDF/image extraction)
PINECONE_INDEX_NAME=coask-knowledge  # Pinecone index name (optional, defaults to this)
```

**Example requests:**

```bash
# Draft an email
curl -X POST http://localhost:3000/agents/email/draft \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "to": "team@example.com",
    "subject": "Feature Launch",
    "context": "Announce the new dashboard feature launching next week",
    "tone": "professional",
    "length": "medium"
  }'

# Generate a reply
curl -X POST http://localhost:3000/agents/email/reply \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "originalEmail": "Hi, when will the feature be ready?",
    "replyContext": "The feature is ready and launching next Monday",
    "tone": "friendly"
  }'

# Get statistics
curl http://localhost:3000/agents/email/stats

# Get conversations
curl http://localhost:3000/agents/email/conversations/user123
```

### Testing the Knowledge Base:

```bash
# Ingest plain text
curl -X POST http://localhost:3000/knowledge/ingest/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Coask is a personal AI automation platform...",
    "fileName": "about-coask.txt",
    "category": "documentation"
  }'

# Ingest from URL
curl -X POST http://localhost:3000/knowledge/ingest/url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/document.pdf",
    "category": "reference"
  }'

# Upload a file
curl -X POST http://localhost:3000/knowledge/ingest/file \
  -F "file=@/path/to/document.pdf" \
  -F "category=documentation"

# Query the knowledge base
curl -X POST http://localhost:3000/knowledge/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is Coask?",
    "topK": 3,
    "minScore": 0.7
  }'

# Get knowledge base statistics
curl http://localhost:3000/knowledge/stats

# Check knowledge base health
curl http://localhost:3000/knowledge/health
```

## Next Phase: Phase 3 - Multi-Agent System

Coming soon...
