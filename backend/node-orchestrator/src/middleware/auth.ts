import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    walletId?: string;
    permissions?: string[];
  };
}

export interface JWTPayload {
  id: string;
  email?: string;
  role?: string;
  walletId?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

// Rate limiting for authentication attempts
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

  // Check rate limiting for auth attempts
  if (isAuthRateLimited(clientIp)) {
    logger.warn('Authentication rate limit exceeded', {
      ip: clientIp,
      userAgent: req.get('User-Agent'),
    });
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Please try again later.',
    });
    return;
  }

  if (!token) {
    recordAuthAttempt(clientIp, false);
    logger.warn('Authentication failed: No token provided', {
      ip: clientIp,
      userAgent: req.get('User-Agent'),
    });
    res.status(401).json({
      success: false,
      error: 'Access token required',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    // Validate token structure
    if (!decoded.id || typeof decoded.id !== 'string') {
      recordAuthAttempt(clientIp, false);
      logger.warn('Invalid token structure', {
        ip: clientIp,
        decoded,
      });
      res.status(403).json({
        success: false,
        error: 'Invalid token structure',
      });
      return;
    }

    recordAuthAttempt(clientIp, true);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      walletId: decoded.walletId,
      permissions: decoded.permissions || [],
    };

    logger.debug('User authenticated successfully', {
      userId: decoded.id,
      role: decoded.role,
      ip: clientIp,
    });

    next();
  } catch (error) {
    recordAuthAttempt(clientIp, false);
    logger.warn('Authentication failed: Invalid token', {
      error: error.message,
      ip: clientIp,
      userAgent: req.get('User-Agent'),
      tokenLength: token.length,
    });

    res.status(403).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};

export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'satsconnect-orchestrator',
    audience: 'satsconnect-mobile',
  } as jwt.SignOptions);
};

export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided, continue without authentication
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      walletId: decoded.walletId,
      permissions: decoded.permissions || [],
    };
  } catch (error) {
    // Invalid token, but continue without authentication
    logger.debug('Optional auth failed: Invalid token', { error: error.message });
  }

  next();
};

export const requireRole = (requiredRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      logger.warn('Insufficient permissions', {
        userId: req.user.id,
        requiredRole,
        userRole: req.user.role,
        ip: req.ip,
      });
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!req.user.permissions?.includes(permission) && req.user.role !== 'admin') {
      logger.warn('Missing permission', {
        userId: req.user.id,
        requiredPermission: permission,
        userPermissions: req.user.permissions,
        ip: req.ip,
      });
      res.status(403).json({
        success: false,
        error: 'Missing required permission',
      });
      return;
    }

    next();
  };
};

function isAuthRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = authAttempts.get(ip);

  if (!attempts) {
    return false;
  }

  // Reset if window has passed
  if (now - attempts.lastAttempt > AUTH_WINDOW_MS) {
    authAttempts.delete(ip);
    return false;
  }

  return attempts.count >= MAX_AUTH_ATTEMPTS;
}

function recordAuthAttempt(ip: string, success: boolean): void {
  const now = Date.now();
  const attempts = authAttempts.get(ip) || { count: 0, lastAttempt: now };

  if (success) {
    // Reset on successful auth
    authAttempts.delete(ip);
  } else {
    // Increment failed attempts
    attempts.count += 1;
    attempts.lastAttempt = now;
    authAttempts.set(ip, attempts);
  }
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of authAttempts.entries()) {
    if (now - attempts.lastAttempt > AUTH_WINDOW_MS) {
      authAttempts.delete(ip);
    }
  }
}, AUTH_WINDOW_MS);
