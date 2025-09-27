import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { join } from 'path';

import config from './config/index';
import logger from './utils/logger';
import grpcClientService from './services/grpcClient';

// Middleware
import { securityHeaders, createRateLimit, requestLogger, sanitizeError } from './middleware/security';
import { sanitizeInput } from './middleware/security';

// Routes
import walletRoutes from './routes/walletRoutes';
import paymentRoutes from './routes/paymentRoutes';
import fiatRoutes from './routes/fiatRoutes';
import webhookRoutes from './routes/webhookRoutes';
import healthRoutes from './routes/healthRoutes';

dotenv.config();

const app = express();

// Security middleware
app.use(securityHeaders);
app.use(createRateLimit());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Input sanitization
app.use(sanitizeInput);

// Health monitoring routes
app.use('/health', healthRoutes);

// API routes
app.use('/api/wallet', walletRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/fiat', fiatRoutes);
app.use('/webhook', webhookRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SatsConnect Node Orchestrator',
    version: '0.1.0',
    description: 'Node.js orchestrator for SatsConnect Lightning Engine',
    status: 'running',
    endpoints: {
      health: '/health',
      wallet: '/api/wallet',
      payments: '/api/payments',
      fiat: '/api/fiat',
      webhooks: '/webhook',
    },
    documentation: {
      wallet: {
        create: 'POST /api/wallet/create',
        balance: 'GET /api/wallet/balance/:id',
        invoice: 'POST /api/wallet/invoice/new',
        send: 'POST /api/wallet/payment/send',
        airtime: 'POST /api/wallet/airtime/buy',
      },
      payments: {
        process: 'POST /api/payments/process',
        status: 'GET /api/payments/:id/status',
        refund: 'POST /api/payments/:id/refund',
      },
      fiat: {
        mpesaBuy: 'POST /api/fiat/mpesa/buy',
        mpesaPayout: 'POST /api/fiat/mpesa/payout',
        airtime: 'POST /api/fiat/airtime',
        transactionStatus: 'GET /api/fiat/transaction/:id',
        providers: 'GET /api/fiat/airtime/providers',
        limits: 'GET /api/fiat/mpesa/limits',
      },
      webhooks: {
        mpesa: 'POST /webhook/mpesa',
        airtime: 'POST /webhook/airtime',
        mpesaPayout: 'POST /webhook/mpesa/payout',
        health: 'GET /webhook/health',
      },
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
  });
});

// Error handling middleware
app.use(sanitizeError);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const port = config.server.port;
app.listen(port, () => {
  logger.info('SatsConnect Node Orchestrator started', {
    port,
    nodeEnv: config.server.nodeEnv,
    grpcUrl: config.rustEngine.grpcUrl,
  });
  
  console.log(`🚀 SatsConnect Node Orchestrator listening on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔗 API docs: http://localhost:${port}/`);
  console.log(`🔧 Environment: ${config.server.nodeEnv}`);
});

export default app;
