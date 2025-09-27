import { Router, Request, Response } from 'express';
import grpcClientService from '../services/grpcClient';
import logger from '../utils/logger';

const router = Router();

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check gRPC engine health
    const engineHealth = await grpcClientService.checkHealth();
    const responseTime = Date.now() - startTime;
    
    const healthStatus = {
      status: engineHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        grpcEngine: engineHealth ? 'up' : 'down',
        orchestrator: 'up',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    };
    
    const statusCode = engineHealth ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
    if (!engineHealth) {
      logger.warn('Health check failed', { responseTime, engineHealth });
    }
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      services: {
        grpcEngine: 'down',
        orchestrator: 'up',
      },
    });
  }
});

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
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version,
      },
      services: {
        grpcEngine: await grpcClientService.checkHealth(),
        orchestrator: true,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
      },
    };
    
    res.json(metrics);
  } catch (error) {
    logger.error('Metrics collection error', { error: error.message });
    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
