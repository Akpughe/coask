import express, { Router } from 'express';
import { config } from '../core/config';

const router: Router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '0.1.0',
  });
});

router.get('/health/ready', (req, res) => {
  // Check if all required services are ready
  const checks = {
    server: true,
    database: false, // Will be updated in Phase 0 when DB is connected
    redis: false, // Will be updated in Phase 4
  };

  const allReady = Object.values(checks).every((check) => check === true);

  res.status(allReady ? 200 : 503).json({
    status: allReady ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
