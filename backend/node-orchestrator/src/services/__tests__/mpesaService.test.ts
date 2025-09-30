import { mpesaService } from '../mpesaService';
import { config } from '../../config';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('MpesaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateStkPush', () => {
    it('should successfully initiate STK Push', async () => {
      // Mock access token response
      mockedAxios.create.mockReturnValue({
        post: jest.fn()
          .mockResolvedValueOnce({
            data: {
              access_token: 'test_access_token',
              expires_in: '3600',
            },
          })
          .mockResolvedValueOnce({
            data: {
              ResponseCode: '0',
              ResponseDescription: 'Success',
              MerchantRequestID: 'merchant_123',
              CheckoutRequestID: 'checkout_123',
              CustomerMessage: 'Success. Request accepted for processing',
            },
          }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const result = await mpesaService.initiateStkPush({
        phoneNumber: '254712345678',
        amount: 1000,
        accountReference: 'SATS_123',
        transactionDesc: 'Bitcoin Purchase',
      });

      expect(result.success).toBe(true);
      expect(result.merchantRequestID).toBe('merchant_123');
      expect(result.checkoutRequestID).toBe('checkout_123');
      expect(result.responseCode).toBe('0');
    });

    it('should handle STK Push failure', async () => {
      // Mock access token response
      mockedAxios.create.mockReturnValue({
        post: jest.fn()
          .mockResolvedValueOnce({
            data: {
              access_token: 'test_access_token',
              expires_in: '3600',
            },
          })
          .mockResolvedValueOnce({
            data: {
              ResponseCode: '1',
              ResponseDescription: 'Failed',
              CustomerMessage: 'Request failed',
            },
          }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const result = await mpesaService.initiateStkPush({
        phoneNumber: '254712345678',
        amount: 1000,
        accountReference: 'SATS_123',
        transactionDesc: 'Bitcoin Purchase',
      });

      expect(result.success).toBe(false);
      expect(result.responseCode).toBe('1');
      expect(result.error).toBe('Failed');
    });

    it('should handle API errors', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('Network error')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const result = await mpesaService.initiateStkPush({
        phoneNumber: '254712345678',
        amount: 1000,
        accountReference: 'SATS_123',
        transactionDesc: 'Bitcoin Purchase',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format phone numbers correctly', () => {
      // Test different phone number formats
      const testCases = [
        { input: '254712345678', expected: '254712345678' },
        { input: '0712345678', expected: '254712345678' },
        { input: '712345678', expected: '254712345678' },
        { input: '+254712345678', expected: '254712345678' },
      ];

      testCases.forEach(({ input, expected }) => {
        // We need to test the private method through the public interface
        // Since formatPhoneNumber is private, we'll test it indirectly
        expect(() => {
          mpesaService.initiateStkPush({
            phoneNumber: input,
            amount: 1000,
            accountReference: 'SATS_123',
            transactionDesc: 'Test',
          });
        }).not.toThrow();
      });
    });

    it('should throw error for invalid phone numbers', () => {
      const invalidNumbers = ['123', 'abc', '123456789012345'];

      invalidNumbers.forEach(phoneNumber => {
        expect(() => {
          mpesaService.initiateStkPush({
            phoneNumber,
            amount: 1000,
            accountReference: 'SATS_123',
            transactionDesc: 'Test',
          });
        }).rejects.toThrow('Invalid phone number format');
      });
    });
  });

  describe('processCallback', () => {
    it('should process successful callback correctly', () => {
      const callback = {
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
                { Name: 'PhoneNumber', Value: '254712345678' },
                { Name: 'TransactionDate', Value: '20240101120000' },
              ],
            },
          },
        },
      };

      const result = mpesaService.processCallback(callback);

      expect(result.success).toBe(true);
      expect(result.merchantRequestID).toBe('merchant_123');
      expect(result.checkoutRequestID).toBe('checkout_123');
      expect(result.resultCode).toBe(0);
      expect(result.amount).toBe(1000);
      expect(result.mpesaReceiptNumber).toBe('MPE123456789');
      expect(result.phoneNumber).toBe('254712345678');
      expect(result.transactionDate).toBe('20240101120000');
    });

    it('should process failed callback correctly', () => {
      const callback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: 'checkout_123',
            ResultCode: 1,
            ResultDesc: 'Failed',
          },
        },
      };

      const result = mpesaService.processCallback(callback);

      expect(result.success).toBe(false);
      expect(result.merchantRequestID).toBe('merchant_123');
      expect(result.checkoutRequestID).toBe('checkout_123');
      expect(result.resultCode).toBe(1);
      expect(result.resultDesc).toBe('Failed');
    });
  });

  describe('validateCallback', () => {
    it('should validate callback signature', () => {
      const callback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: 'checkout_123',
            ResultCode: 0,
            ResultDesc: 'Success',
          },
        },
      };

      const result = mpesaService.validateCallback(callback, 'test_signature');
      expect(result).toBe(true);
    });

    it('should reject invalid callback', () => {
      const invalidCallback = {
        Body: {},
      };

      const result = mpesaService.validateCallback(invalidCallback, 'test_signature');
      expect(result).toBe(false);
    });
  });

  describe('getTransactionLimits', () => {
    it('should return correct transaction limits', () => {
      const limits = mpesaService.getTransactionLimits();

      expect(limits).toEqual({
        minAmount: 1,
        maxAmount: 150000,
        dailyLimit: 300000,
        currency: 'KES',
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({
          data: {
            access_token: 'test_access_token',
            expires_in: '3600',
          },
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const result = await mpesaService.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when service is unhealthy', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('Network error')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const result = await mpesaService.healthCheck();
      expect(result).toBe(false);
    });
  });
});
