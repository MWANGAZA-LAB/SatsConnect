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
  level: config.logging.level,
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
if (config.server.nodeEnv !== 'production') {
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

// Enhanced logger with audit capabilities
class EnhancedLogger {
  private logger: winston.Logger;
  private auditLogger: winston.Logger;
  private securityLogger: winston.Logger;

  constructor() {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.securityLogger = securityLogger;
  }

  // Standard logging methods with redaction
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, redactSensitiveDataAdvanced(meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, redactSensitiveDataAdvanced(meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, redactSensitiveDataAdvanced(meta));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, redactSensitiveDataAdvanced(meta));
  }

  // Audit logging methods
  audit(entry: AuditLogEntry): void {
    this.auditLogger.info('AUDIT', redactSensitiveDataAdvanced(entry));
  }

  // Security event logging
  security(event: string, meta?: Record<string, unknown>): void {
    this.securityLogger.warn(`SECURITY: ${event}`, redactSensitiveDataAdvanced(meta));
  }

  // Request/Response logging with redaction
  logRequest(req: Request, res: Response, responseTime: number): void {
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `${req.method} ${req.path}`,
      userId: (req as any).user?.id,
      action: 'HTTP_REQUEST',
      resource: req.path,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: res.statusCode < 400,
      errorCode: res.statusCode >= 400 ? res.statusCode.toString() : undefined,
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime,
        query: redactSensitiveDataAdvanced(req.query),
        body: redactSensitiveDataAdvanced(req.body),
      },
    };

    this.audit(auditEntry);
  }

  // Authentication events
  logAuthEvent(event: string, userId?: string, success: boolean, meta?: Record<string, unknown>): void {
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      level: success ? 'info' : 'warn',
      message: `Authentication ${event}`,
      userId,
      action: 'AUTHENTICATION',
      resource: 'auth',
      success,
      metadata: redactSensitiveDataAdvanced(meta),
    };

    this.audit(auditEntry);
    
    if (!success) {
      this.security(`AUTH_FAILURE: ${event}`, { userId, ...meta });
    }
  }

  // Wallet operations
  logWalletOperation(operation: string, userId: string, success: boolean, meta?: Record<string, unknown>): void {
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      level: success ? 'info' : 'warn',
      message: `Wallet ${operation}`,
      userId,
      action: 'WALLET_OPERATION',
      resource: 'wallet',
      success,
      metadata: redactSensitiveDataAdvanced(meta),
    };

    this.audit(auditEntry);
  }

  // Payment operations
  logPaymentOperation(operation: string, userId: string, success: boolean, meta?: Record<string, unknown>): void {
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      level: success ? 'info' : 'warn',
      message: `Payment ${operation}`,
      userId,
      action: 'PAYMENT_OPERATION',
      resource: 'payment',
      success,
      metadata: redactSensitiveDataAdvanced(meta),
    };

    this.audit(auditEntry);
  }

  // Security violations
  logSecurityViolation(violation: string, meta?: Record<string, unknown>): void {
    this.security(`VIOLATION: ${violation}`, meta);
  }

  // Rate limiting events
  logRateLimit(ip: string, endpoint: string, meta?: Record<string, unknown>): void {
    this.security('RATE_LIMIT_EXCEEDED', { ip, endpoint, ...meta });
  }
}

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory might already exist
}

// Export enhanced logger
export const logger = new EnhancedLogger();
export default logger;
