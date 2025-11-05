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

## Current Phase: Phase 0 ✅

**Status**: Setup & Foundation Complete

### What's Implemented:
- ✅ TypeScript configuration
- ✅ Express server with health checks
- ✅ Environment configuration
- ✅ Logging utility
- ✅ Prisma ORM setup
- ✅ Project structure

### Available Endpoints:
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check

### Development Commands:
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run production server
pnpm start
```

## Next Phase: Phase 1 - Single Agent + Basic Memory

Coming soon...
