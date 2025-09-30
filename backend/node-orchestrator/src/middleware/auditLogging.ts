import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Simple audit logging middleware
 */
export const auditLogging = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(chunk?: unknown, encoding?: unknown) {
    const responseTime = Date.now() - startTime;
    
    // Log the request/response
    logger.info(`${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};
