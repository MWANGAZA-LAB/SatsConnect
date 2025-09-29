import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Audit logging middleware for comprehensive request/response tracking
 */
export const auditLogging = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    
    // Log the request/response
    logger.logRequest(req, res, responseTime);
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Authentication audit middleware
 */
export const authAudit = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  
  res.send = function(body: any) {
    // Log authentication events
    if (req.path.includes('/auth') || req.path.includes('/login')) {
      const success = res.statusCode < 400;
      const userId = (req as any).user?.id;
      
      logger.logAuthEvent(
        `${req.method} ${req.path}`,
        userId,
        success,
        {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          statusCode: res.statusCode,
        }
      );
    }
    
    return originalSend.call(this, body);
  };

  next();
};

/**
 * Wallet operations audit middleware
 */
export const walletAudit = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  
  res.send = function(body: any) {
    // Log wallet operations
    if (req.path.includes('/wallet')) {
      const success = res.statusCode < 400;
      const userId = (req as any).user?.id;
      
      if (userId) {
        logger.logWalletOperation(
          `${req.method} ${req.path}`,
          userId,
          success,
          {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            operation: req.method,
            endpoint: req.path,
          }
        );
      }
    }
    
    return originalSend.call(this, body);
  };

  next();
};

/**
 * Payment operations audit middleware
 */
export const paymentAudit = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  
  res.send = function(body: any) {
    // Log payment operations
    if (req.path.includes('/payment') || req.path.includes('/fiat')) {
      const success = res.statusCode < 400;
      const userId = (req as any).user?.id;
      
      if (userId) {
        logger.logPaymentOperation(
          `${req.method} ${req.path}`,
          userId,
          success,
          {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            operation: req.method,
            endpoint: req.path,
          }
        );
      }
    }
    
    return originalSend.call(this, body);
  };

  next();
};

/**
 * Security event middleware
 */
export const securityAudit = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  
  res.send = function(body: any) {
    // Log security events
    if (res.statusCode >= 400) {
      const userId = (req as any).user?.id;
      
      logger.security('HTTP_ERROR', {
        userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        error: body,
      });
    }
    
    return originalSend.call(this, body);
  };

  next();
};
