import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

const isProduction = process.env.NODE_ENV === 'production';

// Determine authoritative log directory
const defaultDevLogDir = path.resolve(__dirname, '../../logs');
let resolvedLogDir = process.env.LOG_DIR || (isProduction ? '/var/log/dentalcore' : defaultDevLogDir);

// Safety fallback if /var/log/dentalcore is not writable or running in non-root environment
try {
  if (!fs.existsSync(resolvedLogDir)) {
    fs.mkdirSync(resolvedLogDir, { recursive: true });
  }
} catch (err) {
  resolvedLogDir = defaultDevLogDir;
  if (!fs.existsSync(resolvedLogDir)) {
    fs.mkdirSync(resolvedLogDir, { recursive: true });
  }
}

// Redaction replacer for sensitive security & patient PII keys
const SENSITIVE_KEY_REGEX = /^(password|passwordHash|token|jwt|secret|cookie|authorization|creditCard|cvv|phone|email|address|dateOfBirth|dob|allergies|medicalHistory|notes)$/i;

const sanitizeObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const redactFormat = winston.format((info) => {
  for (const [key, value] of Object.entries(info)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      info[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      info[key] = sanitizeObject(value);
    }
  }
  return info;
});

// File Transports
const combinedFileTransport = new winston.transports.DailyRotateFile({
  dirname: resolvedLogDir,
  filename: 'dentalcore-combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'info',
});

const errorFileTransport = new winston.transports.DailyRotateFile({
  dirname: resolvedLogDir,
  filename: 'dentalcore-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error',
});

// Console Transport
const consoleTransport = new winston.transports.Console({
  format: isProduction
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, requestId, route, status, durationMs, ...meta }) => {
          const reqInfo = requestId ? `[${requestId}]` : '';
          const routeInfo = route ? `${route} ${status || ''} ${durationMs ? `${durationMs}ms` : ''}` : '';
          return `${timestamp || new Date().toISOString()} ${level}: ${reqInfo} ${message} ${routeInfo}`;
        })
      ),
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  defaultMeta: {
    service: 'dentalcore-api',
    env: process.env.NODE_ENV || 'development',
  },
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    redactFormat(),
    winston.format.json()
  ),
  transports: [
    combinedFileTransport,
    errorFileTransport,
    consoleTransport,
  ],
});

export const getLogDirectory = () => resolvedLogDir;
