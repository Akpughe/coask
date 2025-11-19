import express, { Express, Request, Response, NextFunction } from 'express';
import { config } from './core/config';
import { logger } from './utils/logger';
import { startup } from './core/startup';
import healthRouter from './routes/health';
import agentsRouter from './routes/agents';
import knowledgeRouter from './routes/knowledge';
import orchestrationRouter from './routes/orchestration';

// Create Express app
const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
});

// Routes
app.use('/', healthRouter);
app.use('/agents', agentsRouter);
app.use('/knowledge', knowledgeRouter);
app.use('/orchestration', orchestrationRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
  });
});

// Start server
const PORT = config.port;

app.listen(PORT, async () => {
  // Initialize agents and other startup tasks
  await startup();

  logger.info(`🚀 Coask server started`);
  logger.info(`📍 Environment: ${config.nodeEnv}`);
  logger.info(`🌐 Server running on http://localhost:${PORT}`);
  logger.info(`💚 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
