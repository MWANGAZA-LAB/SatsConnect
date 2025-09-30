import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../index';
import grpcClientService from '../../services/grpcClient';
import { generateToken } from '../../middleware/auth';

// Mock the gRPC client service
jest.mock('../../services/grpcClient', () => ({
  getClients: jest.fn(),
  checkHealth: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

const mockGrpcClientService = grpcClientService as jest.Mocked<typeof grpcClientService>;

describe('gRPC Integration Tests', () => {
  const testUser = {
    id: 'test_user_123',
    email: 'test@example.com',
    role: 'user',
  };

  const authToken = generateToken(testUser);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return healthy status when gRPC is available', async () => {
      mockGrpcClientService.checkHealth.mockResolvedValue(true);

      const response = await request(app).get('/health/health').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.services.nodeOrchestrator).toBe('healthy');
      expect(response.body.services.rustEngine).toBe('healthy');
    });

    it('should return degraded status when gRPC is unavailable', async () => {
      mockGrpcClientService.checkHealth.mockResolvedValue(false);

      const response = await request(app).get('/health/health').expect(503);

      expect(response.body.status).toBe('degraded');
      expect(response.body.services.nodeOrchestrator).toBe('healthy');
      expect(response.body.services.rustEngine).toBe('unhealthy');
    });
  });

  describe('Wallet API Integration', () => {
    beforeEach(() => {
      const mockClients = {
        walletClient: {
          CreateWallet: jest.fn(),
          GetBalance: jest.fn(),
          NewInvoice: jest.fn(),
          SendPayment: jest.fn(),
          BuyAirtime: jest.fn(),
        },
        paymentClient: {
          ProcessPayment: jest.fn(),
          GetPaymentStatus: jest.fn(),
          ProcessRefund: jest.fn(),
        },
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients);
    });

    it('should create wallet successfully', async () => {
      const mockClients = mockGrpcClientService.getClients();
      mockClients.walletClient.CreateWallet.mockImplementation((request: unknown, callback: unknown) => {
        (callback as (error: null, response: { node_id: string; address: string }) => void)(null, {
          node_id: 'test_node_id_123',
          address: 'tb1qtest123456789',
        });
      });

      const response = await request(app)
        .post('/api/wallet/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'test-wallet',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.node_id).toBe('test_node_id_123');
      expect(response.body.data.address).toBe('tb1qtest123456789');
    });

    it('should get balance successfully', async () => {
      const mockClients = mockGrpcClientService.getClients();
      mockClients.walletClient.GetBalance.mockImplementation((request: unknown, callback: unknown) => {
        (callback as (error: null, response: { confirmed_sats: number; lightning_sats: number }) => void)(null, {
          confirmed_sats: 1000000,
          lightning_sats: 500000,
        });
      });

      const response = await request(app)
        .get('/api/wallet/balance/test_wallet_123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.confirmed_sats).toBe(1000000);
      expect(response.body.data.lightning_sats).toBe(500000);
    });

    it('should create invoice successfully', async () => {
      const mockClients = mockGrpcClientService.getClients();
      mockClients.walletClient.NewInvoice.mockImplementation((request: unknown, callback: unknown) => {
        (callback as (error: null, response: { invoice: string; payment_hash: string }) => void)(null, {
          invoice: 'lnbc1000u1p3k2v5cpp5test',
          payment_hash: 'test_payment_hash_123',
        });
      });

      const response = await request(app)
        .post('/api/wallet/invoice/new')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_sats: 1000,
          memo: 'Test invoice',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoice).toBe('lnbc1000u1p3k2v5cpp5test');
      expect(response.body.data.payment_hash).toBe('test_payment_hash_123');
    });

    it('should send payment successfully', async () => {
      const mockClients = mockGrpcClientService.getClients();
      mockClients.walletClient.SendPayment.mockImplementation((request: unknown, callback: unknown) => {
        (callback as (error: null, response: { payment_hash: string; status: string }) => void)(null, {
          payment_hash: 'sent_payment_hash_123',
          status: 'SUCCEEDED',
        });
      });

      const response = await request(app)
        .post('/api/wallet/payment/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoice: 'lnbc1000u1p3k2v5cpp5test',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment_hash).toBe('sent_payment_hash_123');
      expect(response.body.data.status).toBe('SUCCEEDED');
    });

    it('should buy airtime successfully', async () => {
      const mockClients = mockGrpcClientService.getClients();
      mockClients.walletClient.BuyAirtime.mockImplementation((request: unknown, callback: unknown) => {
        (callback as (error: null, response: { invoice: string; payment_hash: string; status: string }) => void)(null, {
          invoice: 'lnbc500u1p3k2v5cpp5airtime',
          payment_hash: 'airtime_payment_hash_123',
          status: 'PENDING',
        });
      });

      const response = await request(app)
        .post('/api/wallet/airtime/buy')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_sats: 500,
          phone_number: '+1234567890',
          provider: 'TestProvider',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoice).toBe('lnbc500u1p3k2v5cpp5airtime');
      expect(response.body.data.status).toBe('PENDING');
    });
  });

  describe('Payment API Integration', () => {
    beforeEach(() => {
      const mockClients = {
        walletClient: {},
        paymentClient: {
          ProcessPayment: jest.fn(),
          GetPaymentStatus: jest.fn(),
          ProcessRefund: jest.fn(),
        },
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients);
    });

    it('should process payment successfully', async () => {
      const mockClients = mockGrpcClientService.getClients();
      mockClients.paymentClient.ProcessPayment.mockImplementation((request: unknown, callback: unknown) => {
        (callback as (error: null, response: { payment_id: string; status: string; message: string; amount_sats: number; payment_hash: string; timestamp: string }) => void)(null, {
          payment_id: 'test_payment_123',
          status: 'PENDING',
          message: 'Payment processed',
          amount_sats: 1000,
          payment_hash: 'test_payment_hash_123',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          payment_id: 'test_payment_123',
          wallet_id: 'test_wallet_123',
          amount_sats: 1000,
          invoice: 'lnbc1000u1p3k2v5cpp5test',
          description: 'Test payment',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment_id).toBe('test_payment_123');
      expect(response.body.data.status).toBe('PENDING');
    });

    it('should get payment status successfully', async () => {
      const mockClients = mockGrpcClientService.getClients();
      mockClients.paymentClient.GetPaymentStatus.mockImplementation(
        (request: unknown, callback: unknown) => {
          (callback as (error: null, response: { payment_id: string; status: string; message: string; amount_sats: number; payment_hash: string; timestamp: string }) => void)(null, {
            payment_id: 'test_payment_123',
            status: 'COMPLETED',
            message: 'Payment completed',
            amount_sats: 1000,
            payment_hash: 'test_payment_hash_123',
            timestamp: '2024-01-01T00:00:00Z',
          });
        }
      );

      const response = await request(app)
        .get('/api/payments/test_payment_123/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
    });

    it('should refund payment successfully', async () => {
      const mockClients = mockGrpcClientService.getClients();
      mockClients.paymentClient.ProcessRefund.mockImplementation((request: unknown, callback: unknown) => {
        (callback as (error: null, response: { payment_id: string; status: string; message: string; amount_sats: number; payment_hash: string; timestamp: string }) => void)(null, {
          payment_id: 'test_payment_123',
          status: 'REFUNDED',
          message: 'Payment refunded',
          amount_sats: 1000,
          payment_hash: 'refund_payment_hash_123',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });

      const response = await request(app)
        .post('/api/payments/test_payment_123/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_sats: 1000,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('REFUNDED');
    });
  });

  describe('Error Handling', () => {
    it('should handle gRPC connection errors gracefully', async () => {
      mockGrpcClientService.getClients.mockImplementation(() => {
        throw new Error('gRPC clients not initialized or not connected');
      });

      const response = await request(app)
        .post('/api/wallet/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'test-wallet',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should require authentication for protected routes', async () => {
      const response = await request(app)
        .post('/api/wallet/create')
        .send({
          label: 'test-wallet',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });

    it('should validate request data', async () => {
      const response = await request(app)
        .post('/api/wallet/invoice/new')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_sats: -100, // Invalid negative amount
          memo: 'Test invoice',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});
