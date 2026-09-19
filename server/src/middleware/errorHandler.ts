import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Unhandled Error:', err);

  // Prisma Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(409).json({ error: 'Database conflict or constraint violation' });
  }
  
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ error: 'Database validation failed', details: err.message });
  }
  
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return res.status(500).json({ error: 'Database connection failed' });
  }

  // Fallback for unknown/generic errors
  const status = err.status || 500;
  const message = status === 500 ? 'Internal Server Error' : err.message;
  
  return res.status(status).json({ error: message });
};
