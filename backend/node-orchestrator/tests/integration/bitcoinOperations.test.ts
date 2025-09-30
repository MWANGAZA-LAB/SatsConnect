import request from 'supertest';
import express from 'express';
import bitcoinRoutes from '../../src/routes/bitcoinRoutes';
import bitcoinOperationsService from '../../src/services/bitcoinOperationsService';
import { authenticateToken } from '../../src/middleware/auth';

// Mock the authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  }),
}));

// Mock the bitcoin operations service
jest.mock('../../src/services/bitcoinOperationsService', () => ({
  getExchangeRate: jest.fn(),
  convertKesToSats: jest.fn(),
  convertSatsToKes: jest.fn(),
  creditBitcoin: jest.fn(),
  purchaseAirtime: jest.fn(),
  getBitcoinBalance: jest.fn(),
  getTransactionHistory: jest.fn(),
  processMpesaCallback: jest.fn(),
  validateCallback: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/bitcoin', bitcoinRoutes);

describe('Bitcoin Operations Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/bitcoin/exchange-rate', () => {
    it('should return exchange rate successfully', async () => {
      const mockExchangeRate = {
        rate: 5000000, // 5M KES per BTC
        timestamp: new Date(),
        source: 'CoinGecko',
      };

      (bitcoinOperationsService.getExchangeRate as jest.Mock).mockResolvedValue(mockExchangeRate);

      const response = await request(app)
        .get('/api/bitcoin/exchange-rate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockExchangeRate);
    });

    it('should handle exchange rate fetch failure', async () => {
      (bitcoinOperationsService.getExchangeRate as jest.Mock).mockRejectedValue(
        new Error('Exchange rate service unavailable')
      );

      const response = await request(app)
        .get('/api/bitcoin/exchange-rate')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch exchange rate');
    });
  });

  describe('POST /api/bitcoin/convert/kes-to-sats', () => {
    it('should convert KES to Satoshis successfully', async () => {
      const mockConversion = {
        amountKes: 1000,
        amountSats: 200000, // 200K sats
        exchangeRate: 5000000,
      };

      (bitcoinOperationsService.convertKesToSats as jest.Mock).mockResolvedValue(200000);
      (bitcoinOperationsService.getExchangeRate as jest.Mock).mockResolvedValue({
        rate: 5000000,
        timestamp: new Date(),
        source: 'CoinGecko',
      });

      const response = await request(app)
        .post('/api/bitcoin/convert/kes-to-sats')
        .send({ amountKes: 1000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amountKes).toBe(1000);
      expect(response.body.data.amountSats).toBe(200000);
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/api/bitcoin/convert/kes-to-sats')
        .send({ amountKes: -100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid amount. Must be a positive number.');
    });

    it('should reject missing amount', async () => {
      const response = await request(app)
        .post('/api/bitcoin/convert/kes-to-sats')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid amount. Must be a positive number.');
    });
  });

  describe('POST /api/bitcoin/convert/sats-to-kes', () => {
    it('should convert Satoshis to KES successfully', async () => {
      (bitcoinOperationsService.convertSatsToKes as jest.Mock).mockResolvedValue(1000);
      (bitcoinOperationsService.getExchangeRate as jest.Mock).mockResolvedValue({
        rate: 5000000,
        timestamp: new Date(),
        source: 'CoinGecko',
      });

      const response = await request(app)
        .post('/api/bitcoin/convert/sats-to-kes')
        .send({ amountSats: 200000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amountSats).toBe(200000);
      expect(response.body.data.amountKes).toBe(1000);
    });
  });

  describe('POST /api/bitcoin/credit', () => {
    it('should credit Bitcoin successfully', async () => {
      const mockCreditResponse = {
        success: true,
        transactionId: 'tx_123456789',
        amountSats: 200000,
        amountKes: 1000,
        exchangeRate: 5000000,
        message: 'Successfully credited 200000 satoshis to your wallet',
      };

      (bitcoinOperationsService.creditBitcoin as jest.Mock).mockResolvedValue(mockCreditResponse);

      const response = await request(app)
        .post('/api/bitcoin/credit')
        .send({
          phoneNumber: '254700000000',
          amountKes: 1000,
          mpesaReceiptNumber: 'MPE123456789',
          walletAddress: 'tb1qtest123456789',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCreditResponse);
    });

    it('should handle credit failure', async () => {
      const mockCreditResponse = {
        success: false,
        amountSats: 0,
        amountKes: 1000,
        exchangeRate: 5000000,
        message: 'Amount too small. Minimum 1000 satoshis required.',
        error: 'INSUFFICIENT_AMOUNT',
      };

      (bitcoinOperationsService.creditBitcoin as jest.Mock).mockResolvedValue(mockCreditResponse);

      const response = await request(app)
        .post('/api/bitcoin/credit')
        .send({
          phoneNumber: '254700000000',
          amountKes: 1, // Too small
          mpesaReceiptNumber: 'MPE123456789',
          walletAddress: 'tb1qtest123456789',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.data).toEqual(mockCreditResponse);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/bitcoin/credit')
        .send({
          phoneNumber: '254700000000',
          // Missing other required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Missing required fields');
    });
  });

  describe('POST /api/bitcoin/purchase-airtime', () => {
    it('should purchase airtime successfully', async () => {
      const mockPurchaseResponse = {
        success: true,
        transactionId: 'airtime_123456789',
        amountSats: 200000,
        amountKes: 1000,
        provider: 'Safaricom',
        message: 'Successfully purchased 1000 KES airtime for 254700000000',
      };

      (bitcoinOperationsService.purchaseAirtime as jest.Mock).mockResolvedValue(mockPurchaseResponse);

      const response = await request(app)
        .post('/api/bitcoin/purchase-airtime')
        .send({
          phoneNumber: '254700000000',
          amountSats: 200000,
          provider: 'Safaricom',
          walletAddress: 'tb1qtest123456789',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPurchaseResponse);
    });

    it('should reject invalid provider', async () => {
      const response = await request(app)
        .post('/api/bitcoin/purchase-airtime')
        .send({
          phoneNumber: '254700000000',
          amountSats: 200000,
          provider: 'InvalidProvider',
          walletAddress: 'tb1qtest123456789',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid provider');
    });
  });

  describe('GET /api/bitcoin/balance/:walletAddress', () => {
    it('should return Bitcoin balance successfully', async () => {
      const mockBalance = {
        totalBalance: 1000000,
        availableBalance: 800000,
        pendingBalance: 200000,
        confirmedBalance: 800000,
      };

      (bitcoinOperationsService.getBitcoinBalance as jest.Mock).mockResolvedValue(mockBalance);

      const response = await request(app)
        .get('/api/bitcoin/balance/tb1qtest123456789')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBalance);
    });
  });

  describe('GET /api/bitcoin/transactions/:walletAddress', () => {
    it('should return transaction history successfully', async () => {
      const mockTransactions = [
        {
          txid: 'tx_123456789',
          amount: 200000,
          confirmations: 6,
          status: 'confirmed',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          txid: 'tx_987654321',
          amount: -100000,
          confirmations: 3,
          status: 'confirmed',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (bitcoinOperationsService.getTransactionHistory as jest.Mock).mockResolvedValue(mockTransactions);

      const response = await request(app)
        .get('/api/bitcoin/transactions/tb1qtest123456789?limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toEqual(mockTransactions);
      expect(response.body.data.count).toBe(2);
      expect(response.body.data.limit).toBe(10);
    });

    it('should reject invalid limit', async () => {
      const response = await request(app)
        .get('/api/bitcoin/transactions/tb1qtest123456789?limit=200')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid limit');
    });
  });

  describe('POST /api/bitcoin/webhook/mpesa', () => {
    it('should process MPesa callback successfully', async () => {
      const mockCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: 'checkout_123',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 1000 },
                { Name: 'MpesaReceiptNumber', Value: 'MPE123456789' },
                { Name: 'PhoneNumber', Value: '254700000000' },
              ],
            },
          },
        },
      };

      const mockProcessResponse = {
        success: true,
        transactionId: 'tx_123456789',
        amountSats: 200000,
        amountKes: 1000,
        exchangeRate: 5000000,
        message: 'Successfully credited 200000 satoshis to your wallet',
      };

      (bitcoinOperationsService.validateCallback as jest.Mock).mockReturnValue(true);
      (bitcoinOperationsService.processMpesaCallback as jest.Mock).mockResolvedValue(mockProcessResponse);

      const response = await request(app)
        .post('/api/bitcoin/webhook/mpesa')
        .set('x-mpesa-signature', 'valid_signature')
        .send(mockCallback)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProcessResponse);
    });

    it('should reject invalid callback signature', async () => {
      (bitcoinOperationsService.validateCallback as jest.Mock).mockReturnValue(false);

      const response = await request(app)
        .post('/api/bitcoin/webhook/mpesa')
        .set('x-mpesa-signature', 'invalid_signature')
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid callback signature');
    });
  });

  describe('GET /api/bitcoin/status', () => {
    it('should return Bitcoin operations status', async () => {
      const mockExchangeRate = {
        rate: 5000000,
        timestamp: new Date(),
        source: 'CoinGecko',
      };

      (bitcoinOperationsService.getExchangeRate as jest.Mock).mockResolvedValue(mockExchangeRate);

      const response = await request(app)
        .get('/api/bitcoin/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('operational');
      expect(response.body.data.exchangeRate).toBe(5000000);
    });
  });
});
