import winston from 'winston';
import config from '../config/index';
import { redactSensitiveData } from './encryption';
import { Request, Response } from 'express';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Custom format for console output with sensitive data redaction
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const redactedMeta = redactSensitiveData(meta);
  return `${timestamp} [${level}]: ${message} ${Object.keys(redactedMeta).length ? JSON.stringify(redactedMeta, null, 2) : ''}`;
});

// Custom format for file output with sensitive data redaction
const fileFormat = winston.format((info) => {
  // Redact sensitive data before logging
  if (info.meta) {
    info.meta = redactSensitiveData(info.meta);
  }
  if (info.error) {
    info.error = redactSensitiveData(info.error);
  }
  return info;
});

// Create logger instance
const logger = winston.createLogger({
  level: config?.logging?.level || 'info',
  format: combine(
    fileFormat(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'satsconnect-orchestrator' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs to `combined.log`
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// If we're not in production, log to the console as well
if (config?.server?.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat),
    })
  );
}

// Enhanced redaction patterns for comprehensive data protection
const SENSITIVE_PATTERNS = [
  // JWT tokens
  /jwt[_-]?token/i,
  /bearer\s+[a-zA-Z0-9._-]+/i,
  /authorization/i,
  
  // API keys and secrets
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /passkey/i,
  
  // Bitcoin/Lightning specific
  /mnemonic/i,
  /seed[_-]?phrase/i,
  /private[_-]?key/i,
  /wallet[_-]?seed/i,
  /lnbc[a-zA-Z0-9]+/i, // Lightning invoices
  /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/, // Bitcoin addresses
  
  // Personal information
  /phone[_-]?number/i,
  /email/i,
  /ssn/i,
  /social[_-]?security/i,
  
  // Financial data
  /amount/i,
  /balance/i,
  /transaction[_-]?id/i,
  /payment[_-]?hash/i,
  
  // Device identifiers
  /device[_-]?id/i,
  /user[_-]?agent/i,
  /ip[_-]?address/i,
];

// Enhanced redaction function
function redactSensitiveDataAdvanced(data: unknown): unknown {
  if (typeof data === 'string') {
    let redacted = data;
    
    // Check against sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(redacted)) {
        redacted = '[REDACTED]';
        break;
      }
    }
    
    // Redact long strings that might be sensitive
    if (redacted.length > 50 && !redacted.includes(' ')) {
      redacted = '[REDACTED_LONG_STRING]';
    }
    
    return redacted;
  }
  
  if (Array.isArray(data)) {
    return data.map(redactSensitiveDataAdvanced);
  }
  
  if (data && typeof data === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Check if key itself is sensitive
      const isKeySensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
      redacted[key] = isKeySensitive ? '[REDACTED]' : redactSensitiveDataAdvanced(value);
    }
    return redacted;
  }
  
  return data;
}

// Audit log interface
export interface AuditLogEntry {
  timestamp: string;
  level: string;
  message: string;
  userId?: string;
  action: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

// Create audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: { service: 'satsconnect-audit' },
  transports: [
    new winston.transports.File({
      filename: 'logs/audit.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
});

// Security event logger
const securityLogger = winston.createLogger({
  level: 'warn',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: { service: 'satsconnect-security' },
  transports: [
    new winston.transports.File({
      filename: 'logs/security.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
});

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory might already exist
}

// Export the basic logger with redaction
export { logger };
export default logger;
