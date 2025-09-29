import { jest } from '@jest/globals';
import paymentService from '../../services/paymentService';
import grpcClientService from '../../services/grpcClient';

// Mock the gRPC client service
jest.mock('../../services/grpcClient', () => ({
  getClients: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

const mockGrpcClientService = grpcClientService as jest.Mocked<typeof grpcClientService>;

describe('PaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      const mockClients = {
        walletClient: {},
        paymentClient: {
          ProcessPayment: jest.fn((request: unknown, callback: unknown) => {
            (callback as (error: null, response: { payment_id: string; status: string; message: string; amount_sats: number; payment_hash: string; timestamp: string }) => void)(null, {
              payment_id: 'test_payment_123',
              status: 'PENDING',
              message: 'Payment processed',
              amount_sats: 1000,
              payment_hash: 'test_payment_hash_123',
              timestamp: '2024-01-01T00:00:00Z',
            });
          }),
        },
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as unknown);

      const result = await paymentService.processPayment({
        payment_id: 'test_payment_123',
        wallet_id: 'test_wallet_123',
        amount_sats: 1000,
        invoice: 'lnbc1000u1p3k2v5cpp5test',
        description: 'Test payment',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        payment_id: 'test_payment_123',
        status: 'PENDING',
        message: 'Payment processed',
        amount_sats: 1000,
        payment_hash: 'test_payment_hash_123',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should process payment without payment_id', async () => {
      const mockClients = {
        walletClient: {},
        paymentClient: {
          ProcessPayment: jest.fn((request: unknown, callback: unknown) => {
            (callback as (error: null, response: { payment_id: string; status: string; message: string; amount_sats: number; payment_hash: string; timestamp: string }) => void)(null, {
              payment_id: 'generated_payment_456',
              status: 'PENDING',
              message: 'Payment processed',
              amount_sats: 500,
              payment_hash: 'generated_payment_hash_456',
              timestamp: '2024-01-01T00:00:00Z',
            });
          }),
        },
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as unknown);

      const result = await paymentService.processPayment({
        wallet_id: 'test_wallet_123',
        amount_sats: 500,
        invoice: 'lnbc500u1p3k2v5cpp5test',
        description: 'Test payment without ID',
      });

      expect(result.success).toBe(true);
      expect(result.data?.payment_id).toBe('generated_payment_456');
    });

    it('should handle gRPC errors', async () => {
      const mockClients = {
        walletClient: {},
        paymentClient: {
          ProcessPayment: jest.fn((request: unknown, callback: unknown) => {
            (callback as (error: Error, response: null) => void)(new Error('Invalid invoice format'), null);
          }),
        },
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as unknown);

      const result = await paymentService.processPayment({
        wallet_id: 'test_wallet_123',
        amount_sats: 1000,
        invoice: 'invalid_invoice',
        description: 'Test payment',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('gRPC call failed: Invalid invoice format');
    });
  });

  describe('getPaymentStatus', () => {
    it('should get payment status successfully', async () => {
      const mockClients = {
        walletClient: {},
        paymentClient: {
          GetPaymentStatus: jest.fn((request: unknown, callback: unknown) => {
            (callback as (error: null, response: { payment_id: string; status: string; message: string; amount_sats: number; payment_hash: string; timestamp: string }) => void)(null, {
              payment_id: 'test_payment_123',
              status: 'COMPLETED',
              message: 'Payment completed',
              amount_sats: 1000,
              payment_hash: 'test_payment_hash_123',
              timestamp: '2024-01-01T00:00:00Z',
            });
          }),
        },
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as unknown);

      const result = await paymentService.getPaymentStatus({
        payment_id: 'test_payment_123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        payment_id: 'test_payment_123',
        status: 'COMPLETED',
        message: 'Payment completed',
        amount_sats: 1000,
        payment_hash: 'test_payment_hash_123',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should handle payment not found', async () => {
      const mockClients = {
        walletClient: {},
        paymentClient: {
          GetPaymentStatus: jest.fn((request: unknown, callback: unknown) => {
            callback(new Error('Payment not found'), null);
          }),
        },
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as unknown);

      const result = await paymentService.getPaymentStatus({
        payment_id: 'nonexistent_payment',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('gRPC call failed: Payment not found');
    });
  });

  describe('refundPayment', () => {
    it('should refund payment successfully', async () => {
      const mockClients = {
        walletClient: {},
        paymentClient: {
          ProcessRefund: jest.fn((request: unknown, callback: unknown) => {
            (callback as (error: null, response: { payment_id: string; status: string; message: string; amount_sats: number; payment_hash: string; timestamp: string }) => void)(null, {
              payment_id: 'test_payment_123',
              status: 'REFUNDED',
              message: 'Payment refunded',
              amount_sats: 1000,
              payment_hash: 'refund_payment_hash_123',
              timestamp: '2024-01-01T00:00:00Z',
            });
          }),
        },
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as unknown);

      const result = await paymentService.refundPayment({
        payment_id: 'test_payment_123',
        amount_sats: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        payment_id: 'test_payment_123',
        status: 'REFUNDED',
        message: 'Payment refunded',
        amount_sats: 1000,
        payment_hash: 'refund_payment_hash_123',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should handle refund errors', async () => {
      const mockClients = {
        walletClient: {},
        paymentClient: {
          ProcessRefund: jest.fn((request: unknown, callback: unknown) => {
            callback(new Error('Payment cannot be refunded'), null);
          }),
        },
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as unknown);

      const result = await paymentService.refundPayment({
        payment_id: 'test_payment_123',
        amount_sats: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('gRPC call failed: Payment cannot be refunded');
    });
  });
});
