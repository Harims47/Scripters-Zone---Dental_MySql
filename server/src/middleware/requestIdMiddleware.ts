import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Regex to validate incoming Request ID format and prevent log/header injection
const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-]{8,64}$/;

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const incomingId = req.headers['x-request-id'];
  let authoritativeId: string;

  if (typeof incomingId === 'string' && REQUEST_ID_REGEX.test(incomingId.trim())) {
    authoritativeId = incomingId.trim();
  } else {
    authoritativeId = crypto.randomUUID();
  }

  req.id = authoritativeId;
  res.setHeader('X-Request-ID', authoritativeId);

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const status = res.statusCode;
    const user = (req as any).user;

    const logPayload = {
      requestId: authoritativeId,
      method: req.method,
      route: req.originalUrl || req.url,
      status,
      durationMs,
      userId: user?.id,
      role: user?.role,
      clientIp: req.ip || req.socket.remoteAddress,
      message: `${req.method} ${req.originalUrl || req.url} ${status} - ${durationMs}ms`,
    };

    if (status >= 500) {
      logger.error('HTTP Server Error', logPayload);
    } else if (status >= 400) {
      logger.warn('HTTP Client Warning', logPayload);
    } else {
      logger.info('HTTP Request Complete', logPayload);
    }
  });

  next();
};
