import { Router, Request, Response } from 'express';
import grpcClientService from '../services/grpcClient';
import queueService from '../services/queueService';
import { logger } from '../utils/logger';
import config from '../config';
import { checkEngineHealth } from '../grpc';

const router = Router();

// Comprehensive health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const healthChecks = await performHealthChecks();
    const responseTime = Date.now() - startTime;

    const overallHealth = Object.values(healthChecks).every(check => check.status === 'healthy');
    const statusCode = overallHealth ? 200 : 503;

    const healthStatus = {
      status: overallHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: healthChecks,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version,
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: config.server.nodeEnv,
    };

    res.status(statusCode).json(healthStatus);

    if (!overallHealth) {
      logger.warn('Health check failed', { 
        responseTime, 
        healthChecks,
        failedServices: Object.entries(healthChecks)
          .filter(([_, check]) => check.status !== 'healthy')
          .map(([name, _]) => name)
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Health check error', { error: errorMessage });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      services: {
        grpcEngine: 'down',
        orchestrator: 'up',
        redis: 'unknown',
        queue: 'unknown',
      },
    });
  }
});

// Perform comprehensive health checks
async function performHealthChecks(): Promise<Record<string, { status: string; details?: unknown; responseTime?: string }>> {
  const checks: Record<string, { status: string; details?: unknown; responseTime?: string }> = {};

  // gRPC Engine check
  try {
    const startTime = Date.now();
    const engineHealth = await checkEngineHealth();
    const responseTime = Date.now() - startTime;
    
    checks.grpcEngine = {
      status: engineHealth ? 'healthy' : 'unhealthy',
      responseTime: `${responseTime}ms`,
      details: {
        address: config.rustEngine.grpcUrl,
        tls: config.rustEngine.useTls,
      }
    };
  } catch (error) {
    checks.grpcEngine = {
      status: 'unhealthy',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }

  // Redis/Queue check
  try {
    const startTime = Date.now();
    // Test queue service health
    const queueHealth = await testQueueHealth();
    const responseTime = Date.now() - startTime;
    
    checks.redis = {
      status: queueHealth ? 'healthy' : 'unhealthy',
      responseTime: `${responseTime}ms`,
      details: {
        url: config.redis.url,
        concurrency: config.queue.concurrency,
      }
    };
  } catch (error) {
    checks.redis = {
      status: 'unhealthy',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }

  // Orchestrator check
  checks.orchestrator = {
    status: 'healthy',
    details: {
      port: config.server.port,
      environment: config.server.nodeEnv,
      rateLimit: {
        windowMs: config.rateLimit.windowMs,
        maxRequests: config.rateLimit.maxRequests,
      }
    }
  };

  // Memory check
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
  const memoryThreshold = 500; // 500MB threshold

  checks.memory = {
    status: memoryUsageMB < memoryThreshold ? 'healthy' : 'warning',
    details: {
      heapUsed: `${Math.round(memoryUsageMB)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      threshold: `${memoryThreshold}MB`,
    }
  };

  return checks;
}

// Test queue health
async function testQueueHealth(): Promise<boolean> {
  try {
    // Try to get job status as a simple health check
    await queueService.getJobStatus('health-check-test');
    return true;
  } catch (error) {
    logger.debug('Queue health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return false;
  }
}

// Readiness probe
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all critical services are ready
    const engineHealth = await grpcClientService.checkHealth();

    if (engineHealth) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          grpcEngine: 'ready',
          orchestrator: 'ready',
        },
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        services: {
          grpcEngine: 'not ready',
          orchestrator: 'ready',
        },
      });
    }
  } catch (error) {
    logger.error('Readiness check error', { error: error.message });
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    });
  }
});

// Liveness probe
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Detailed system metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const healthChecks = await performHealthChecks();
    const memoryUsage = process.memoryUsage();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        },
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid,
      },
      services: healthChecks,
      environment: {
        nodeEnv: config.server.nodeEnv,
        port: config.server.port,
        rustEngineUrl: config.rustEngine.grpcUrl,
        redisUrl: config.redis.url,
      },
      configuration: {
        rateLimit: config.rateLimit,
        queue: config.queue,
        logging: config.logging,
      },
    };

    res.json(metrics);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Metrics collection error', { error: errorMessage });
    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

// Performance metrics endpoint
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const performance = {
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsedPercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: {
        seconds: process.uptime(),
        formatted: formatUptime(process.uptime()),
      },
      gc: {
        // Node.js doesn't expose GC stats directly, but we can infer from memory
        estimatedCollections: Math.floor(memoryUsage.heapUsed / (1024 * 1024 * 10)), // Rough estimate
      },
    };

    res.json(performance);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Performance metrics error', { error: errorMessage });
    res.status(500).json({
      error: 'Failed to collect performance metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

// Service status endpoint
router.get('/status', async (req: Request, res: Response) => {
  try {
    const healthChecks = await performHealthChecks();
    const overallStatus = Object.values(healthChecks).every(check => check.status === 'healthy') ? 'operational' : 'degraded';
    
    const status = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: Object.entries(healthChecks).map(([name, check]) => ({
        name,
        status: check.status,
        responseTime: check.responseTime,
        details: check.details,
      })),
      summary: {
        total: Object.keys(healthChecks).length,
        healthy: Object.values(healthChecks).filter(check => check.status === 'healthy').length,
        unhealthy: Object.values(healthChecks).filter(check => check.status === 'unhealthy').length,
        warning: Object.values(healthChecks).filter(check => check.status === 'warning').length,
      },
    };

    res.json(status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Status check error', { error: errorMessage });
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to check service status',
    });
  }
});

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export default router;
