import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// In production, JWT_SECRET must be explicitly provided and cannot use dev default
const DEFAULT_DEV_SECRET = 'dev_secret_key_change_in_production';
let jwtSecret = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;

if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_DEV_SECRET) {
    console.error('FATAL PRODUCTION SECURITY ERROR: JWT_SECRET environment variable is missing or set to the default development secret!');
    process.exit(1);
  }
  jwtSecret = process.env.JWT_SECRET;
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: isProduction,
  PORT: process.env.PORT || 3001,
  JWT_SECRET: jwtSecret,
  DATABASE_URL: process.env.DATABASE_URL || '',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  COMMUNICATION_WEBHOOK_SECRET: process.env.COMMUNICATION_WEBHOOK_SECRET || '',
  LOG_DIR: process.env.LOG_DIR || '',
};
