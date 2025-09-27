import request from 'supertest';
import express from 'express';
import fiatRoutes from '../../routes/fiatRoutes';
import webhookRoutes from '../../routes/webhookRoutes';
import { authenticateToken } from '../../middleware/auth';

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test_user_id' };
    next();
  },
}));

// Mock services
jest.mock('../../services/mpesaService');
jest.mock('../../services/airtimeService');
jest.mock('../../services/queueService');
jest.mock('../../services/walletService');

const app = express();
app.use(express.json());
app.use('/api/fiat', fiatRoutes);
app.use('/webhook', webhookRoutes);

describe('Fiat Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/fiat/mpesa/buy', () => {
    it('should initiate MPesa buy transaction successfully', async () => {
      const mockQueueService = require('../../services/queueService');
      mockQueueService.addMpesaBuyJob.mockResolvedValue({ id: 'test_job_id' });

      const response = await request(app)
        .post('/api/fiat/mpesa/buy')
        .send({
          phoneNumber: '254712345678',
          amount: 1000,
          walletId: 'test_wallet_id',
          accountReference: 'test_ref',
          transactionDesc: 'Bitcoin Purchase',
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
      expect(response.body.data.status).toBe('pending');
      expect(mockQueueService.addMpesaBuyJob).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: '254712345678',
          amount: 1000,
          walletId: 'test_wallet_id',
          accountReference: 'test_ref',
          transactionDesc: 'Bitcoin Purchase',
        })
      );
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/fiat/mpesa/buy')
        .send({
          phoneNumber: 'invalid_phone',
          amount: 1000,
          walletId: 'test_wallet_id',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate amount limits', async () => {
      const response = await request(app)
        .post('/api/fiat/mpesa/buy')
        .send({
          phoneNumber: '254712345678',
          amount: 200000, // Exceeds limit
          walletId: 'test_wallet_id',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require wallet ID', async () => {
      const response = await request(app)
        .post('/api/fiat/mpesa/buy')
        .send({
          phoneNumber: '254712345678',
          amount: 1000,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/fiat/mpesa/payout', () => {
    it('should initiate MPesa payout transaction successfully', async () => {
      const mockQueueService = require('../../services/queueService');
      mockQueueService.addMpesaPayoutJob.mockResolvedValue({ id: 'test_job_id' });

      const response = await request(app)
        .post('/api/fiat/mpesa/payout')
        .send({
          phoneNumber: '254712345678',
          amount: 1000,
          lightningInvoice: 'lnbc1000n1p...',
          accountReference: 'test_ref',
          transactionDesc: 'Bitcoin Payout',
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
      expect(response.body.data.status).toBe('pending');
      expect(mockQueueService.addMpesaPayoutJob).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: '254712345678',
          amount: 1000,
          lightningInvoice: 'lnbc1000n1p...',
          accountReference: 'test_ref',
          transactionDesc: 'Bitcoin Payout',
        })
      );
    });

    it('should require lightning invoice', async () => {
      const response = await request(app)
        .post('/api/fiat/mpesa/payout')
        .send({
          phoneNumber: '254712345678',
          amount: 1000,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/fiat/airtime', () => {
    it('should initiate airtime purchase successfully', async () => {
      const mockQueueService = require('../../services/queueService');
      mockQueueService.addAirtimeJob.mockResolvedValue({ id: 'test_job_id' });

      const response = await request(app)
        .post('/api/fiat/airtime')
        .send({
          phoneNumber: '254712345678',
          amount: 100,
          provider: 'safaricom',
          lightningInvoice: 'lnbc1000n1p...',
          reference: 'test_ref',
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
      expect(response.body.data.status).toBe('pending');
      expect(mockQueueService.addAirtimeJob).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: '254712345678',
          amount: 100,
          provider: 'safaricom',
          lightningInvoice: 'lnbc1000n1p...',
          reference: 'test_ref',
        })
      );
    });

    it('should validate provider', async () => {
      const response = await request(app)
        .post('/api/fiat/airtime')
        .send({
          phoneNumber: '254712345678',
          amount: 100,
          provider: 'invalid_provider',
          lightningInvoice: 'lnbc1000n1p...',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate airtime amount limits', async () => {
      const response = await request(app)
        .post('/api/fiat/airtime')
        .send({
          phoneNumber: '254712345678',
          amount: 5, // Below minimum
          provider: 'safaricom',
          lightningInvoice: 'lnbc1000n1p...',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/fiat/transaction/:transactionId', () => {
    it('should get transaction status successfully', async () => {
      const mockQueueService = require('../../services/queueService');
      mockQueueService.getJobStatus.mockResolvedValue({
        id: 'test_job_id',
        name: 'mpesa-buy',
        data: { transactionId: 'test_transaction_id' },
        progress: 50,
        state: 'active',
        returnvalue: null,
        failedReason: null,
      });

      const response = await request(app)
        .get('/api/fiat/transaction/test_transaction_id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBe('test_transaction_id');
      expect(response.body.data.status).toBe('active');
    });

    it('should return 404 for non-existent transaction', async () => {
      const mockQueueService = require('../../services/queueService');
      mockQueueService.getJobStatus.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/fiat/transaction/non_existent_id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Transaction not found');
    });
  });

  describe('GET /api/fiat/airtime/providers', () => {
    it('should return supported airtime providers', async () => {
      const response = await request(app)
        .get('/api/fiat/airtime/providers');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.providers).toHaveLength(3);
      expect(response.body.data.providers[0]).toEqual({
        id: 'safaricom',
        name: 'Safaricom',
        minAmount: 10,
        maxAmount: 10000,
        currency: 'KES',
      });
    });
  });

  describe('GET /api/fiat/mpesa/limits', () => {
    it('should return MPesa transaction limits', async () => {
      const response = await request(app)
        .get('/api/fiat/mpesa/limits');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.buy).toEqual({
        minAmount: 1,
        maxAmount: 150000,
        currency: 'KES',
        description: 'MPesa STK Push limits for buying Bitcoin',
      });
      expect(response.body.data.payout).toEqual({
        minAmount: 1,
        maxAmount: 150000,
        currency: 'KES',
        description: 'MPesa payout limits for selling Bitcoin',
      });
    });
  });

  describe('Webhook Tests', () => {
    describe('POST /webhook/mpesa', () => {
      it('should process MPesa callback successfully', async () => {
        const mockMpesaService = require('../../services/mpesaService');
        mockMpesaService.validateCallback.mockReturnValue(true);
        mockMpesaService.extractTransactionDetails.mockReturnValue({
          merchantRequestID: 'test_merchant_id',
          checkoutRequestID: 'test_checkout_id',
          resultCode: 0,
          resultDesc: 'Success',
          amount: 1000,
          mpesaReceiptNumber: 'test_receipt',
        });

        const callback = {
          Body: {
            stkCallback: {
              MerchantRequestID: 'test_merchant_id',
              CheckoutRequestID: 'test_checkout_id',
              ResultCode: 0,
              ResultDesc: 'Success',
            },
          },
        };

        const response = await request(app)
          .post('/webhook/mpesa')
          .set('x-mpesa-signature', 'test_signature')
          .send(callback);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockMpesaService.validateCallback).toHaveBeenCalledWith(callback, 'test_signature');
        expect(mockMpesaService.extractTransactionDetails).toHaveBeenCalledWith(callback);
      });

      it('should reject invalid signature', async () => {
        const mockMpesaService = require('../../services/mpesaService');
        mockMpesaService.validateCallback.mockReturnValue(false);

        const response = await request(app)
          .post('/webhook/mpesa')
          .set('x-mpesa-signature', 'invalid_signature')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invalid signature');
      });
    });

    describe('POST /webhook/airtime', () => {
      it('should process airtime callback successfully', async () => {
        const mockAirtimeService = require('../../services/airtimeService');
        mockAirtimeService.validateCallback.mockReturnValue(true);

        const callback = {
          transactionId: 'test_transaction_id',
          status: 'success',
          amount: 100,
          phoneNumber: '254712345678',
          provider: 'safaricom',
          message: 'Airtime purchased successfully',
        };

        const response = await request(app)
          .post('/webhook/airtime')
          .set('x-signature', 'test_signature')
          .send(callback);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockAirtimeService.validateCallback).toHaveBeenCalledWith(callback, 'test_signature');
      });
    });

    describe('GET /webhook/health', () => {
      it('should return webhook health status', async () => {
        const response = await request(app)
          .get('/webhook/health');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Webhook service is healthy');
        expect(response.body.timestamp).toBeDefined();
      });
    });
  });
});
