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

## Current Phase: Phase 1 ✅

**Status**: Single Agent + Basic Memory Complete

### What's Implemented:
- ✅ TypeScript configuration
- ✅ Express server with health checks
- ✅ Environment configuration
- ✅ Logging utility
- ✅ Prisma ORM setup
- ✅ LLM client wrapper (OpenAI & Anthropic)
- ✅ In-memory conversation store
- ✅ Email Agent with drafting and reply capabilities
- ✅ Agent API endpoints
- ✅ Project structure

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

### Development Commands:
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run production server
pnpm start
```

### Testing the Email Agent:

**Note:** You need to add your OpenAI or Anthropic API key to `.env` to use the Email Agent:
```bash
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
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

## Next Phase: Phase 2 - Knowledge Base + Custom RAG Pipeline

Coming soon...
