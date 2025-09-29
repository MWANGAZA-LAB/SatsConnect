import request from 'supertest';
import express from 'express';
import fiatRoutes from '../../routes/fiatRoutes';

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: unknown, res: unknown, next: unknown) => {
    (req as { user: { id: string } }).user = { id: 'test_user_id' };
    (next as () => void)();
  },
}));

// Mock services
jest.mock('../../services/queueService', () => ({
  addMpesaBuyJob: jest.fn().mockResolvedValue({ id: 'test_job_id' }),
  addMpesaPayoutJob: jest.fn().mockResolvedValue({ id: 'test_job_id' }),
  addAirtimeJob: jest.fn().mockResolvedValue({ id: 'test_job_id' }),
  getJobStatus: jest.fn().mockResolvedValue({
    id: 'test_job_id',
    name: 'mpesa-buy',
    data: { transactionId: 'test_transaction_id' },
    progress: 50,
    state: 'active',
    returnvalue: null,
    failedReason: null,
  }),
}));

const app = express();
app.use(express.json());
app.use('/api/fiat', fiatRoutes);

describe('Fiat Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/fiat/mpesa/buy', () => {
    it('should initiate MPesa buy transaction successfully', async () => {
      const mockQueueService = require('../../services/queueService');

      const response = await request(app).post('/api/fiat/mpesa/buy').send({
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
      const response = await request(app).post('/api/fiat/mpesa/buy').send({
        phoneNumber: 'invalid_phone',
        amount: 1000,
        walletId: 'test_wallet_id',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate amount limits', async () => {
      const response = await request(app).post('/api/fiat/mpesa/buy').send({
        phoneNumber: '254712345678',
        amount: 200000, // Exceeds limit
        walletId: 'test_wallet_id',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require wallet ID', async () => {
      const response = await request(app).post('/api/fiat/mpesa/buy').send({
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

      const response = await request(app).post('/api/fiat/mpesa/payout').send({
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
      const response = await request(app).post('/api/fiat/mpesa/payout').send({
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

      const response = await request(app).post('/api/fiat/airtime').send({
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
      const response = await request(app).post('/api/fiat/airtime').send({
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
      const response = await request(app).post('/api/fiat/airtime').send({
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

      const response = await request(app).get('/api/fiat/transaction/test_transaction_id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBe('test_transaction_id');
      expect(response.body.data.status).toBe('active');
    });

    it('should return 404 for non-existent transaction', async () => {
      const mockQueueService = require('../../services/queueService');
      mockQueueService.getJobStatus.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/fiat/transaction/non_existent_id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Transaction not found');
    });
  });

  describe('GET /api/fiat/airtime/providers', () => {
    it('should return supported airtime providers', async () => {
      const response = await request(app).get('/api/fiat/airtime/providers');

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
      const response = await request(app).get('/api/fiat/mpesa/limits');

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
});
