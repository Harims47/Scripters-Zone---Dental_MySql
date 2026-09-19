import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { logger } from '../utils/logger';

const router = Router();

// Liveness check: confirms Express process is alive and receiving traffic
router.get('/live', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'dentalcore-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness check: verifies database connectivity without leaking credentials or internal schema
router.get('/ready', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Readiness check failed - Database unavailable', {
      error: error.message,
      requestId: req.id,
    });
    return res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      requestId: req.id,
      timestamp: new Date().toISOString(),
    });
  }
});

// Legacy backward-compatibility endpoint
router.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'DentalCore backend is running' });
});

export default router;
