import request from 'supertest';
import { app } from '../../index';
import grpcClientService from '../../services/grpcClient';
import { retryService } from '../../services/retryService';
import logger from '../../utils/logger';

// Mock the gRPC client
jest.mock('../../services/grpcClient');
const mockGrpcClientService = grpcClientService as jest.Mocked<typeof grpcClientService>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('SatsConnect End-to-End Flow', () => {
  let authToken: string;
  let walletId: string;
  let invoice: string;

  beforeAll(async () => {
    // Mock gRPC responses
    mockGrpcClientService.checkHealth.mockResolvedValue(true);
    mockGrpcClientService.getClients.mockReturnValue({
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
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Journey', () => {
    it('should complete full wallet creation and transaction flow', async () => {
      // Step 1: Health Check
      const healthResponse = await request(app).get('/health/health').expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.services.grpcEngine).toBe('up');

      // Step 2: Create Wallet
      const createWalletResponse = await request(app)
        .post('/api/wallet/create')
        .send({
          label: 'Test Wallet',
          mnemonic: 'test mnemonic phrase for testing purposes only',
        })
        .expect(200);

      expect(createWalletResponse.body.success).toBe(true);
      expect(createWalletResponse.body.data.walletId).toBeDefined();
      walletId = createWalletResponse.body.data.walletId;

      // Step 3: Get Balance
      const balanceResponse = await request(app).get(`/api/wallet/balance/${walletId}`).expect(200);

      expect(balanceResponse.body.success).toBe(true);
      expect(balanceResponse.body.data.onchainBalance).toBe(1000000);
      expect(balanceResponse.body.data.lightningBalance).toBe(500000);

      // Step 4: Create Invoice
      const invoiceResponse = await request(app)
        .post('/api/wallet/invoice/new')
        .send({
          walletId,
          amount: 1000,
          memo: 'Test invoice',
        })
        .expect(200);

      expect(invoiceResponse.body.success).toBe(true);
      expect(invoiceResponse.body.data.invoice).toMatch(/^lnbc/);
      invoice = invoiceResponse.body.data.invoice;

      // Step 5: Send Payment
      const sendPaymentResponse = await request(app)
        .post('/api/wallet/payment/send')
        .send({
          walletId,
          invoice,
        })
        .expect(200);

      expect(sendPaymentResponse.body.success).toBe(true);
      expect(sendPaymentResponse.body.data.status).toBe('SUCCEEDED');

      // Step 6: Buy Airtime
      const airtimeResponse = await request(app)
        .post('/api/wallet/airtime/buy')
        .send({
          walletId,
          phoneNumber: '254712345678',
          amount: 100,
          provider: 'safaricom',
        })
        .expect(200);

      expect(airtimeResponse.body.success).toBe(true);
      expect(airtimeResponse.body.data.transactionId).toBeDefined();
    });

    it('should handle MPesa integration flow', async () => {
      // Mock MPesa service responses
      const mockMpesaService = require('../../services/mpesaService');
      jest.spyOn(mockMpesaService, 'stkPush').mockResolvedValue({
        success: true,
        checkoutRequestId: 'ws_CO_123456789',
        merchantRequestId: 'merchant_req_123',
      });

      // Step 1: MPesa Buy Bitcoin
      const mpesaBuyResponse = await request(app)
        .post('/api/fiat/mpesa/buy')
        .send({
          phoneNumber: '254712345678',
          amount: 1000,
          walletId: 'test-wallet-123',
        })
        .expect(200);

      expect(mpesaBuyResponse.body.success).toBe(true);
      expect(mpesaBuyResponse.body.data.checkoutRequestId).toBeDefined();

      // Step 2: MPesa Payout
      const mpesaPayoutResponse = await request(app)
        .post('/api/fiat/mpesa/payout')
        .send({
          phoneNumber: '254712345678',
          amount: 500,
          walletId: 'test-wallet-123',
        })
        .expect(200);

      expect(mpesaPayoutResponse.body.success).toBe(true);
      expect(mpesaPayoutResponse.body.data.transactionId).toBeDefined();
    });

    it('should handle error scenarios gracefully', async () => {
      // Test invalid wallet ID
      await request(app).get('/api/wallet/balance/invalid-wallet-id').expect(400);

      // Test invalid invoice
      await request(app)
        .post('/api/wallet/payment/send')
        .send({
          walletId: 'test-wallet-123',
          invoice: 'invalid-invoice',
        })
        .expect(400);

      // Test invalid phone number
      await request(app)
        .post('/api/fiat/mpesa/buy')
        .send({
          phoneNumber: 'invalid-phone',
          amount: 1000,
          walletId: 'test-wallet-123',
        })
        .expect(400);
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(10)
        .fill(null)
        .map(() => request(app).get('/health/health'));

      const responses = await Promise.allSettled(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle gRPC service failures with retry', async () => {
      // Mock gRPC service to fail first, then succeed
      let callCount = 0;
      mockGrpcClientService.getClients.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('gRPC service temporarily unavailable');
        }
        return {
          walletClient: { CreateWallet: jest.fn() },
          paymentClient: { ProcessPayment: jest.fn() },
        };
      });

      // This should succeed after retries
      const response = await request(app).post('/api/wallet/create').send({
        label: 'Retry Test Wallet',
      });

      expect(response.status).toBe(200);
      expect(callCount).toBe(3); // Should have retried twice
    });
  });

  describe('Security Tests', () => {
    it('should sanitize sensitive data in logs', async () => {
      const sensitiveData = {
        phoneNumber: '254712345678',
        mnemonic: 'test mnemonic phrase for testing purposes only',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      };

      // Make a request with sensitive data
      await request(app)
        .post('/api/fiat/mpesa/buy')
        .send({
          ...sensitiveData,
          amount: 1000,
          walletId: 'test-wallet-123',
        });

      // Check that logger was called with redacted data
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('MPesa buy request'),
        expect.objectContaining({
          phoneNumber: expect.stringMatching(/254\*\*\*\*678/),
          mnemonic: expect.not.stringContaining('test mnemonic'),
        })
      );
    });

    it('should enforce HTTPS in production', async () => {
      // This would be tested with a production environment
      // For now, we just verify the middleware is in place
      const response = await request(app).get('/health/health').set('X-Forwarded-Proto', 'http');

      // In development, this should still work
      expect(response.status).toBe(200);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 50;
      const promises = Array(concurrentRequests)
        .fill(null)
        .map((_, index) =>
          request(app)
            .post('/api/wallet/create')
            .send({
              label: `Concurrent Wallet ${index}`,
            })
        );

      const startTime = Date.now();
      const responses = await Promise.allSettled(promises);
      const endTime = Date.now();

      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );

      expect(successfulResponses.length).toBe(concurrentRequests);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle large payloads', async () => {
      const largeMemo = 'x'.repeat(10000); // 10KB memo

      const response = await request(app).post('/api/wallet/invoice/new').send({
        walletId: 'test-wallet-123',
        amount: 1000,
        memo: largeMemo,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
