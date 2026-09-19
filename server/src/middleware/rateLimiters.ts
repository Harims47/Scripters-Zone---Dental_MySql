import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

// Export endpoints (CSV/PDF bulk queries)
export const exportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isProduction ? 30 : 5000,
  message: { error: 'Too many export requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Financial mutations (Payments, Billing)
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isProduction ? 60 : 5000,
  message: { error: 'Too many payment requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Outbound Notification operations (SMS/WhatsApp cost protection)
export const notificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isProduction ? 30 : 5000,
  message: { error: 'Too many notification dispatch requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
