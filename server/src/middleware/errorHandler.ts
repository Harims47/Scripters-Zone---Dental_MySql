import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.id;
  const status = err.status || (err.statusCode || 500);

  // Structured server-side diagnostic log with complete stack trace and Request ID
  logger.error('Unhandled Application Error', {
    requestId,
    method: req.method,
    route: req.originalUrl || req.url,
    userId: (req as any).user?.id,
    role: (req as any).user?.role,
    errorName: err.name,
    errorMessage: err.message,
    stack: err.stack,
  });

  // Prisma Schema Validation Errors - Never leak internal schema details to the client
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: 'Invalid data format provided to database',
      requestId,
    });
  }

  // Prisma Constraint Violations (Foreign Key, Unique Key)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(409).json({
      error: 'Database conflict or constraint violation',
      requestId,
    });
  }

  // Prisma Connection / Initialization Failures
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return res.status(503).json({
      error: 'Database service temporarily unavailable',
      requestId,
    });
  }

  // Payload Too Large
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      error: 'Payload Too Large: Request body exceeds maximum allowed size',
      requestId,
    });
  }

  // Generic and operational errors
  const isProduction = process.env.NODE_ENV === 'production';
  const clientMessage = status >= 500
    ? 'Internal Server Error'
    : (err.message || 'An unexpected error occurred');

  return res.status(status).json({
    error: clientMessage,
    requestId,
    ...(isProduction ? {} : { devDetails: err.message }),
  });
};
