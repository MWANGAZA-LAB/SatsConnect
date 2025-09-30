import request from 'supertest';
import app from '../../index';
import { testUtils } from '../setup';
import { generateToken } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../services/queueService', () => ({
  addMpesaBuyJob: jest.fn().mockResolvedValue({ id: 'test_job_id' }),
  addMpesaPayoutJob: jest.fn().mockResolvedValue({ id: 'test_job_id' }),
  addAirtimeJob: jest.fn().mockResolvedValue({ id: 'test_job_id' }),
  getJobStatus: jest.fn().mockResolvedValue({
    id: 'test_job_id',
    name: 'mpesa-buy',
    data: { transactionId: 'test_transaction_id' },
    state: 'completed',
  }),
}));

jest.mock('../../services/mpesaService', () => ({
  stkPush: jest.fn().mockResolvedValue({
    success: true,
    checkoutRequestId: 'ws_CO_123456789',
    merchantRequestId: 'merchant_req_123',
  }),
  validateCallback: jest.fn().mockReturnValue(true),
  extractTransactionDetails: jest.fn().mockReturnValue({
    merchantRequestID: 'test_merchant_id',
    checkoutRequestID: 'test_checkout_id',
    resultCode: 0,
    resultDesc: 'Success',
  }),
}));

jest.mock('../../services/airtimeService', () => ({
  validateCallback: jest.fn().mockReturnValue(true),
  processCallback: jest.fn().mockResolvedValue({ success: true }),
}));

// Use the main app from index.ts

describe('REST API Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Wait for engine to be ready
    await testUtils.waitForEngine();
    // Use the main app from index.ts

    // Generate auth token for tests
    authToken = generateToken({
      id: 'test-user',
      role: 'user',
      permissions: ['wallet:read', 'wallet:write', 'payment:read', 'payment:write'],
    });
  });

  describe('Health Check', () => {
    test('GET /health should return service status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('nodeOrchestrator');
      expect(response.body.services).toHaveProperty('rustEngine');
    });

    test('GET / should return API information', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('endpoints');
    });
  });

  describe('Wallet API Endpoints', () => {
    test('POST /api/wallet/create should create wallet', async () => {
      const testData = testUtils.generateTestData();

      const response = await request(app)
        .post('/api/wallet/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData.wallet)
        .expect(201);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');

      if (response.body.data) {
        expect(response.body.data).toHaveProperty('nodeId');
        expect(response.body.data).toHaveProperty('address');
      }
    });

    test('GET /api/wallet/balance should return balance', async () => {
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');

      if (response.body.data) {
        expect(response.body.data).toHaveProperty('onchainSats');
        expect(response.body.data).toHaveProperty('lightningSats');
        expect(response.body.data).toHaveProperty('totalSats');
      }
    });

    test('POST /api/wallet/invoice should create invoice', async () => {
      const testData = testUtils.generateTestData();

      const response = await request(app)
        .post('/api/wallet/invoice')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData.invoice)
        .expect(201);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');

      if (response.body.data) {
        expect(response.body.data).toHaveProperty('invoice');
        expect(response.body.data).toHaveProperty('paymentHash');
        expect(response.body.data).toHaveProperty('amountSats');
      }
    });

    test('POST /api/wallet/send should send payment', async () => {
      const testData = testUtils.generateTestData();

      const response = await request(app)
        .post('/api/wallet/send')
        .send({ invoice: 'lnbc10u1p3k2v5cpp5...' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
    });

    test('POST /api/wallet/buy-airtime should create airtime invoice', async () => {
      const response = await request(app)
        .post('/api/wallet/buy-airtime')
        .send({
          amountSats: 5000,
          phoneNumber: '+1234567890',
          provider: 'MTN',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');

      if (response.body.data) {
        expect(response.body.data).toHaveProperty('invoice');
        expect(response.body.data).toHaveProperty('paymentHash');
        expect(response.body.data).toHaveProperty('amountSats');
        expect(response.body.data).toHaveProperty('phoneNumber');
        expect(response.body.data).toHaveProperty('provider');
      }
    });
  });

  describe('Payment API Endpoints', () => {
    test('POST /api/payments/process should process payment', async () => {
      const testData = testUtils.generateTestData();

      const response = await request(app)
        .post('/api/payments/process')
        .send(testData.payment)
        .expect(201);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');

      if (response.body.data) {
        expect(response.body.data).toHaveProperty('paymentId');
        expect(response.body.data).toHaveProperty('status');
        expect(response.body.data).toHaveProperty('amountSats');
        expect(response.body.data).toHaveProperty('createdAt');
        expect(response.body.data).toHaveProperty('updatedAt');
      }
    });

    test('GET /api/payments/:paymentId/status should return payment status', async () => {
      const testData = testUtils.generateTestData();

      const response = await request(app)
        .get(`/api/payments/${testData.payment.paymentId}/status`)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
    });

    test('POST /api/payments/:paymentId/refund should process refund', async () => {
      const testData = testUtils.generateTestData();

      const response = await request(app)
        .post(`/api/payments/${testData.payment.paymentId}/refund`)
        .send({ amountSats: 500 })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');

      if (response.body.data) {
        expect(response.body.data).toHaveProperty('paymentId');
        expect(response.body.data).toHaveProperty('status');
        expect(response.body.data).toHaveProperty('refundAmountSats');
        expect(response.body.data).toHaveProperty('updatedAt');
      }
    });

    test('GET /api/payments/stream/:walletId should stream payments', async () => {
      const testData = testUtils.generateTestData();

      const response = await request(app)
        .get(`/api/payments/stream/${testData.payment.walletId}`)
        .query({ limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');

      if (response.body.data) {
        expect(response.body.data).toHaveProperty('payments');
        expect(response.body.data).toHaveProperty('count');
        expect(Array.isArray(response.body.data.payments)).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid wallet creation', async () => {
      const response = await request(app)
        .post('/api/wallet/create')
        .send({ mnemonic: 'invalid mnemonic' })
        .expect(400);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle invalid invoice creation', async () => {
      const response = await request(app)
        .post('/api/wallet/invoice')
        .send({ amountSats: -100 })
        .expect(400);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle invalid payment', async () => {
      const response = await request(app)
        .post('/api/wallet/send')
        .send({ invoice: '' })
        .expect(400);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle 404 for unknown endpoints', async () => {
      const response = await request(app).get('/api/unknown').expect(404);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/api/wallet/balance').set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
      });
    });

    test('should handle rapid sequential requests', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/api/wallet/balance')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
      }
    });
  });

  describe('Content Type Tests', () => {
    test('should accept JSON content type', async () => {
      const response = await request(app)
        .post('/api/wallet/invoice')
        .set('Content-Type', 'application/json')
        .send({ amountSats: 1000, memo: 'test' })
        .expect(201);

      expect(response.body).toHaveProperty('success');
    });

    test('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
