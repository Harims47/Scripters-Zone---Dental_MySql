import './config/env'; // Must be first to enforce production environment assertions
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requestIdMiddleware } from './middleware/requestIdMiddleware';
import { csrfMiddleware } from './middleware/csrfMiddleware';
import { logger } from './utils/logger';

import authRoutes from './routes/authRoutes';
import patientRoutes from './routes/patientRoutes';
import patientHistoryRoutes from './routes/patientHistoryRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import visitRoutes from './routes/visitRoutes';
import queueRoutes from './routes/queueRoutes';
import consultationRoutes from './routes/consultationRoutes';
import prescriptionRoutes from './routes/prescriptionRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import dispensingRoutes from './routes/dispensingRoutes';
import billingRoutes from './routes/billingRoutes';
import paymentRoutes from './routes/paymentRoutes';
import reportsRoutes from './routes/reportsRoutes';
import staffRoutes from './routes/staffRoutes';
import documentRoutes from './routes/documentRoutes';
import treatmentRoutes, { patientTreatmentRouter } from './routes/treatmentRoutes';
import supplierRoutes from './routes/supplierRoutes';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes';
import supplierBillRoutes from './routes/supplierBillRoutes';
import medicineCategoryRoutes from './routes/medicineCategoryRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import notificationRoutes from './routes/notificationRoutes';
import webhookRoutes from './routes/webhookRoutes';
import historicalMigrationRoutes from './routes/historicalMigrationRoutes';
import reimbursementRoutes from './routes/reimbursementRoutes';
import healthRoutes from './routes/healthRoutes';

import { QueueRunner } from './services/communication/queueRunner';
import { HistoricalBatchService } from './services/historicalMigration/HistoricalBatchService';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './db';

const app = express();
const port = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Trust reverse proxy for accurate client IP in express-rate-limit and secure cookies
app.set('trust proxy', 1);

// Security Headers via Helmet with progressive CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"], // Allows base64 camera photos
      connectSrc: ["'self'", process.env.FRONTEND_ORIGIN || "http://localhost:5173"],
      frameSrc: ["'self'", "blob:"], // Allows inline PDF receipt/prescription viewing
      objectSrc: ["'self'", "blob:"], // Allows embedded PDF viewer
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  frameguard: {
    action: 'sameorigin', // Permits inline modal preview of clinic documents on the same origin
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  crossOriginEmbedderPolicy: false,
}));

// Request correlation and access logging
app.use(requestIdMiddleware);

// Body Parsers: Global bounded limit (2mb default)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
app.use(cookieParser());

// Production CORS
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// CSRF and Origin Protection
app.use(csrfMiddleware);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/patients', express.json({ limit: '15mb' }), patientRoutes); // Route-scoped higher limit for webcam photos
app.use('/api/patients', patientHistoryRoutes); // Mounts /:patientId/history
app.use('/api/patients', patientTreatmentRouter); // Mounts /:patientId/treatment-plan without catalog conflict
app.use('/api/appointments', appointmentRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/supplier-bills', supplierBillRoutes);
app.use('/api/medicine-categories', medicineCategoryRoutes);
app.use('/api/dispensings', dispensingRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/webhooks/communication', webhookRoutes);
app.use('/api/historical-migration', historicalMigrationRoutes);
app.use('/api/reimbursements', reimbursementRoutes);

// Error Handler
app.use(errorHandler);

// Global Uncaught Exception & Unhandled Rejection Lifecycle
process.on('uncaughtException', (err: Error) => {
  logger.error('FATAL PROCESS ERROR: uncaughtException', {
    errorName: err.name,
    errorMessage: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('FATAL PROCESS ERROR: unhandledRejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

const server = app.listen(Number(port), '0.0.0.0', () => {
  logger.info(`Server is running on port ${port}`, { port });
  // [Diagnostic] QueueRunner startup temporarily disabled for diagnostic investigation
  logger.info('[Diagnostic] QueueRunner startup is temporarily DISABLED for diagnostic investigation');
  HistoricalBatchService.recoverStaleMigrationJobs().catch((err) => {
    logger.error('Failed to recover stale historical migration jobs', { error: err.message });
  });
});

// Graceful Shutdown Mechanism
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  QueueRunner.stop();
  server.close(async () => {
    logger.info('HTTP server closed.');
    await prisma.$disconnect();
    logger.info('Database connection closed.');
    process.exit(0);
  });

  // Force close after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
