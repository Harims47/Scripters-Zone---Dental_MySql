import { Request, Response, NextFunction } from 'express';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Validates Origin and Referer on state-changing requests to protect against CSRF.
 */
export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Safe HTTP methods (GET, HEAD, OPTIONS) do not alter server state
  if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  // Exempt public webhooks which use signature token verification
  if (req.path.startsWith('/api/webhooks/communication')) {
    return next();
  }

  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

  // Allowed origins list
  const allowedOrigins = new Set<string>([
    configuredOrigin.toLowerCase().replace(/\/$/, ''),
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ]);

  const extractOrigin = (urlString?: string): string | null => {
    if (!urlString) return null;
    try {
      const parsed = new URL(urlString);
      return parsed.origin.toLowerCase();
    } catch {
      return null;
    }
  };

  const reqOrigin = origin ? extractOrigin(origin) : null;
  const reqRefererOrigin = referer ? extractOrigin(referer) : null;
  const candidateOrigin = reqOrigin || reqRefererOrigin;

  // If an Origin or Referer is supplied, it MUST match an allowed origin
  if (candidateOrigin) {
    if (!allowedOrigins.has(candidateOrigin)) {
      return res.status(403).json({
        error: 'Forbidden: Invalid or untrusted request origin',
        requestId: (req as any).id,
      });
    }
    return next();
  }

  // If neither Origin nor Referer is provided:
  // In production, all requests missing Origin and Referer are strictly blocked.
  // In non-production, browser requests (indicated by Sec-Fetch-* metadata) are strictly blocked.
  const isBrowserRequest = Boolean(req.headers['sec-fetch-site'] || req.headers['sec-fetch-mode']);
  if (isProduction || isBrowserRequest) {
    return res.status(403).json({
      error: 'Forbidden: Missing Origin and Referer headers on state-changing request',
      requestId: (req as any).id,
    });
  }

  // Permit programmatic CLI test runners in dev/test only when explicitly non-browser
  return next();
};
