# Coask - Personal AI Automation Platform

> **Your intelligent team of AI agents** — specialized assistants that share one memory and work together to automate complex tasks.

[![Status](https://img.shields.io/badge/status-planning-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## 🎯 What is Coask?

Coask is a **personal AI automation platform** that acts as your intelligent assistant team. Tell it what you want in plain English, and it will:

- 🤖 **Coordinate specialized AI agents** (email, calendar, research, reporting)
- 🧠 **Remember everything** (conversations, preferences, company knowledge)
- ⏰ **Automate recurring tasks** (daily, weekly, custom schedules)
- 🔌 **Connect to your tools** (Gmail, Calendar, APIs, databases)
- 📊 **Learn and improve** (gets better over time)

### Example Use Cases

**Email Campaign Automation**
```
You: "Get users from my API, write them an onboarding email using our knowledge base,
     show me for approval, then send every 3 days via Resend."

Coask: ✅ Fetches users → ✅ Drafts personalized emails → ✅ Shows preview →
       ✅ Schedules recurring sends → ✅ Tracks performance
```

**Subscription Reminders**
```
You: "Check my Gmail for subscriptions and remind me 3 days before renewal."

Coask: ✅ Scans Gmail → ✅ Identifies subscriptions → ✅ Adds calendar reminders →
       ✅ Sends summary email
```

**Research & Reporting**
```
You: "Check this API every morning for trending topics and email me a summary."

Coask: ✅ Calls API daily → ✅ Analyzes data → ✅ Generates report → ✅ Emails you
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│         Natural Language Interface           │
│    "Send an email to all new users..."      │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Agent Coordinator                  │
│   Routes tasks to specialized agents         │
└──────────────────┬──────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Email   │  │Research │  │Calendar │
│ Agent   │  │ Agent   │  │ Agent   │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │             │
     └────────────┼─────────────┘
                  ▼
     ┌────────────────────────┐
     │   Shared Memory        │
     │   Knowledge Base       │
     │   Job Queue            │
     └────────────────────────┘
```

**Core Components:**
- **Multi-Agent System**: Specialized AI agents (email, calendar, research, reporting)
- **Memory System**: Episodic (history), Semantic (knowledge), Working (context)
- **Orchestration**: LangGraph coordinates agent collaboration
- **Scheduling**: BullMQ + Redis for automated recurring tasks
- **Integrations**: Gmail, Calendar, Resend, custom APIs

---

## 🚀 Current Status

**Phase**: Phase 1 Complete ✅

We've completed **Phase 0** (Setup & Foundation) and **Phase 1** (Single Agent + Basic Memory)!

### Completed Phases
- ✅ **Phase 0**: Setup & Foundation ([Details](./docs/PHASE_0_COMPLETE.md))
  - TypeScript configuration
  - Express server with health checks
  - Environment configuration & logging
  - Prisma ORM setup

- ✅ **Phase 1**: Single Agent + Basic Memory ([Details](./docs/PHASE_1_COMPLETE.md))
  - LLM client wrapper (OpenAI & Anthropic)
  - In-memory conversation store
  - Email Agent with draft & reply capabilities
  - RESTful API endpoints

### Documentation
- ✅ [System Architecture](./docs/SYSTEM_ARCHITECTURE.md) - Complete technical architecture
- ✅ [Technology Stack](./docs/TECHNOLOGY_STACK.md) - Tools, frameworks, and services
- ✅ [Implementation Roadmap](./docs/IMPLEMENTATION_ROADMAP.md) - 6-phase build plan

### Next Steps
1. ✅ ~~Set up development environment (Phase 0)~~
2. ✅ ~~Build first agent (Phase 1)~~
3. **→ Add knowledge base with custom RAG pipeline (Phase 2)** ← Next
4. Coordinate multiple agents (Phase 3)
5. Add scheduling automation (Phase 4)
6. Build integrations and UI (Phase 5)
7. Deploy to production (Phase 6)

**Estimated Remaining Timeline**: 2-4 months

---

## 📚 Documentation

### Planning Documents
- [**System Architecture**](./docs/SYSTEM_ARCHITECTURE.md)
  - High-level architecture
  - Component breakdown
  - Data flow diagrams
  - Security considerations

- [**Technology Stack**](./docs/TECHNOLOGY_STACK.md)
  - Core technologies (Node.js, TypeScript, LangGraph)
  - AI frameworks (LangChain, LlamaIndex)
  - Memory systems (Mem0, Pinecone)
  - Integrations (Google APIs, Resend)
  - Cost estimates

- [**Implementation Roadmap**](./docs/IMPLEMENTATION_ROADMAP.md)
  - Phase 0: Setup & Foundation
  - Phase 1: Single Agent + Basic Memory
  - Phase 2: Knowledge Base + RAG
  - Phase 3: Multi-Agent System
  - Phase 4: Scheduling & Automation
  - Phase 5: Integrations & Polish
  - Phase 6: Production & Scale

### Future Documentation (To Be Created)
- API Documentation
- Deployment Guide
- Agent Development Guide
- User Manual
- Contributing Guide

---

## 🛠️ Technology Stack

### Core
- **Runtime**: Node.js 20 + TypeScript 5
- **Framework**: Express
- **Agent Orchestration**: LangGraph + LangChain
- **LLM Providers**: OpenAI GPT-4 Turbo, Anthropic Claude 3.5

### Memory & Knowledge
- **Long-term Memory**: Mem0
- **Vector Database**: Pinecone
- **RAG Framework**: LlamaIndex
- **Cache**: Redis

### Infrastructure
- **Database**: PostgreSQL (Prisma ORM)
- **Job Queue**: BullMQ + Redis
- **Scheduling**: Cron expressions
- **Hosting**: Railway / Render

### Integrations
- **Email**: Resend (MVP), Postmark (production)
- **Google Workspace**: Gmail, Calendar, Docs (OAuth 2.0)
- **Monitoring**: Winston, Sentry

### Frontend (Optional)
- **Framework**: Next.js 14
- **Styling**: TailwindCSS
- **State**: Zustand

[Full details in Technology Stack →](./docs/TECHNOLOGY_STACK.md)

---

## 🎨 Key Features (Planned)

### Phase 1 Features
- ✅ Single AI agent (email)
- ✅ Basic conversation memory
- ✅ Email drafting and sending
- ✅ API endpoints

### Phase 2 Features
- ✅ Vector database for knowledge
- ✅ RAG system for context retrieval
- ✅ Knowledge base management
- ✅ Document ingestion

### Phase 3 Features
- ✅ Multiple specialized agents
- ✅ Agent orchestration (LangGraph)
- ✅ Multi-step workflows
- ✅ Inter-agent communication

### Phase 4 Features
- ✅ Cron scheduling
- ✅ Recurring tasks
- ✅ Job queue management
- ✅ Monitoring dashboard

### Phase 5 Features
- ✅ Google Calendar integration
- ✅ Gmail integration
- ✅ CSV upload support
- ✅ Web UI
- ✅ User authentication

### Phase 6 Features
- ✅ Production deployment
- ✅ Monitoring and alerts
- ✅ Performance optimization
- ✅ Security hardening

---

## 💻 Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/coask.git
cd coask

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Add your API keys to .env (required for Email Agent):
#   OPENAI_API_KEY=sk-...
#   OR
#   ANTHROPIC_API_KEY=sk-ant-...

# Start development server
pnpm dev

# Server will start on http://localhost:3000
```

### Available Endpoints

**Health Checks:**
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (Kubernetes-ready)

**Email Agent:**
- `POST /agents/email/draft` - Draft a new email
- `POST /agents/email/reply` - Generate email reply
- `GET /agents/email/stats` - Get agent statistics
- `GET /agents/email/conversations/:userId` - Get user conversations
- `DELETE /agents/email/history/:userId` - Clear conversation history

See [src/README.md](./src/README.md) for detailed API documentation and example requests.

---

## 🧪 Example Usage (Planned)

### Draft and Send Email
```typescript
POST /api/email/draft
{
  "userId": "user123",
  "recipient": "john@example.com",
  "purpose": "Invite to beta program",
  "useKnowledge": true
}

// Agent retrieves relevant info from knowledge base and drafts email

POST /api/email/send
{
  "email": { /* draft from above */ }
}
```

### Schedule Recurring Campaign
```typescript
POST /api/schedule/recurring
{
  "userId": "user123",
  "apiUrl": "https://api.yourapp.com/users",
  "emailPurpose": "Weekly newsletter",
  "cronExpression": "0 9 * * MON"  // Every Monday at 9 AM
}

// System automatically sends emails every Monday
```

### Query Knowledge Base
```typescript
POST /api/knowledge/ask
{
  "question": "What are our pricing tiers?"
}

// Response
{
  "answer": "We offer three pricing tiers: Basic at $10/month..."
}
```

---

## 🤝 Contributing

This project is currently in planning phase. Once we start development, we'll welcome contributions!

### How to Contribute (Future)
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📊 Project Roadmap

### Q1 2025 (Planning & Foundation)
- ✅ System architecture design
- ✅ Technology stack selection
- ✅ Implementation roadmap
- ✅ Phase 0: Setup & Foundation (Complete)
- ✅ Phase 1: Single Agent + Basic Memory (Complete)

### Q2 2025 (MVP Development)
- ⏳ Phase 2: Knowledge Base + Custom RAG Pipeline (In Progress)
- ⏳ Phase 3: Multi-Agent System
- ⏳ Early user testing

### Q3 2025 (Full Features)
- ⏳ Phase 4: Scheduling
- ⏳ Phase 5: Integrations
- ⏳ Beta testing

### Q4 2025 (Production)
- ⏳ Phase 6: Production deployment
- ⏳ Public launch
- ⏳ Gather user feedback

---

## 💡 Inspiration & Research

This project is inspired by:
- **Multi-agent AI systems** (AutoGPT, MetaGPT, CrewAI)
- **AI assistants** (ChatGPT, Claude, Gemini)
- **Workflow automation** (Zapier, n8n, Make)
- **Personal productivity tools** (Notion, Todoist, Calendly)

Key differentiators:
- **Shared memory across agents** (agents learn from each other)
- **Natural language interface** (no complex workflow building)
- **Intelligent context retrieval** (RAG for knowledge base)
- **Self-contained platform** (not just an integration layer)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 👥 Team

- **Your Name** - Project Lead & Architect
- *Open for contributors once development starts*

---

## 📞 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/coask/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/coask/discussions)
- **Email**: your.email@example.com

---

## 🙏 Acknowledgments

Built with amazing open-source tools:
- [LangChain](https://langchain.com) - Agent framework
- [LangGraph](https://langchain-ai.github.io/langgraph/) - Multi-agent orchestration
- [Pinecone](https://pinecone.io) - Vector database
- [BullMQ](https://bullmq.io) - Job queue
- [Mem0](https://mem0.ai) - AI memory system
- [OpenAI](https://openai.com) - LLM provider
- [Anthropic](https://anthropic.com) - Claude LLM

---

## 🌟 Star History

If you find this project interesting, please consider starring it!

---

**Status**: Phase 1 Complete ✅ | Building Phase 2 🚧
**Last Update**: Phase 1 - Single Agent + Basic Memory
**Next Milestone**: Phase 2 - Knowledge Base + Custom RAG Pipeline

**Questions?** Open an issue or discussion!
