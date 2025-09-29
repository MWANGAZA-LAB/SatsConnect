import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from '../config/index';
import logger from '../utils/logger';
import { body, validationResult } from 'express-validator';

// Rate limiting middleware
export const createRateLimit = () => {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      res.status(429).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
      });
    },
  });
};

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// HTTPS enforcement middleware
export const enforceHttps = (req: Request, res: Response, next: NextFunction): void => {
  // Skip HTTPS enforcement in development
  if (config.server.nodeEnv === 'development') {
    return next();
  }

  // Check if request is secure
  if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
    logger.warn('HTTPS enforcement: Redirecting HTTP to HTTPS', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
    });

    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }

  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Remove any potential script tags or dangerous characters
  const sanitizeString = (str: string): string => {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  };

  // Sanitize phone numbers (Kenyan format)
  const sanitizePhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Convert to Kenyan format (254XXXXXXXXX)
    if (digits.startsWith('0')) {
      return '254' + digits.substring(1);
    } else if (digits.startsWith('254')) {
      return digits;
    } else if (digits.startsWith('7') && digits.length === 9) {
      return '254' + digits;
    }

    return digits;
  };

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    const sanitizeObject = (obj: unknown): unknown => {
      if (typeof obj === 'string') {
        // Special handling for phone numbers
        if (obj.match(/^[\d\s\-+()]+$/) && obj.length >= 9) {
          return sanitizePhoneNumber(obj);
        }
        return sanitizeString(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj && typeof obj === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          // Special handling for phone number fields
          if (key.toLowerCase().includes('phone') && typeof value === 'string') {
            sanitized[key] = sanitizePhoneNumber(value);
          } else {
            sanitized[key] = sanitizeObject(value);
          }
        }
        return sanitized;
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        if (key.toLowerCase().includes('phone')) {
          req.query[key] = sanitizePhoneNumber(value);
        } else {
          req.query[key] = sanitizeString(value);
        }
      }
    }
  }

  next();
};

// Enhanced input validation middleware
export const validateInput = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    logger.warn('Input validation failed', {
      errors: errors.array(),
      ip: req.ip,
      url: req.url,
      method: req.method,
    });

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((err) => ({
        field: err.type === 'field' ? err.path : 'unknown',
        message: err.msg,
        value: err.type === 'field' ? err.value : undefined,
      })),
    });
    return;
  }

  next();
};

// Phone number validation
export const validatePhoneNumber = (field: string = 'phoneNumber') => {
  return body(field)
    .isMobilePhone('en-KE')
    .withMessage('Valid Kenyan phone number required')
    .custom((value) => {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 12) {
        throw new Error('Phone number must be 9-12 digits');
      }
      return true;
    });
};

// Amount validation
export const validateAmount = (
  field: string = 'amount',
  min: number = 1,
  max: number = 1000000
) => {
  return body(field)
    .isFloat({ min, max })
    .withMessage(`Amount must be between ${min} and ${max}`)
    .custom((value) => {
      if (value <= 0) {
        throw new Error('Amount must be positive');
      }
      return true;
    });
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

// Error sanitization middleware
export const sanitizeError = (err: unknown, req: Request, res: Response, next: NextFunction): void => {
  // Don't leak internal error details in production
  if (config.server.nodeEnv === 'production') {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorStack = err instanceof Error ? err.stack : undefined;
    
    logger.error('Internal server error', {
      error: errorMessage,
      stack: errorStack,
      url: req.url,
      method: req.method,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  } else {
    // In development, show full error details
    next(err);
  }
};
