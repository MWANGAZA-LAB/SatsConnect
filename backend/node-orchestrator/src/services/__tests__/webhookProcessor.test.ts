import { webhookProcessor } from '../webhookProcessor';
import { mpesaService } from '../mpesaService';
import { bitcoinOperationsService } from '../bitcoinOperationsService';

// Mock dependencies
jest.mock('../mpesaService');
jest.mock('../bitcoinOperationsService');

const mockedMpesaService = mpesaService as jest.Mocked<typeof mpesaService>;
const mockedBitcoinOperationsService = bitcoinOperationsService as jest.Mocked<typeof bitcoinOperationsService>;

describe('WebhookProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processMpesaCallback', () => {
    it('should process successful MPesa callback correctly', async () => {
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

      const signature = 'valid_signature';

      // Mock service responses
      mockedMpesaService.validateCallback.mockReturnValue(true);
      mockedMpesaService.processCallback.mockReturnValue({
        success: true,
        merchantRequestID: 'merchant_123',
        checkoutRequestID: 'checkout_123',
        resultCode: 0,
        resultDesc: 'Success',
        amount: 1000,
        mpesaReceiptNumber: 'MPE123456789',
        phoneNumber: '254712345678',
        transactionDate: '20240101120000',
      });

      mockedBitcoinOperationsService.creditBitcoin.mockResolvedValue({
        success: true,
        transactionId: 'tx_123456789',
        amountSats: 200000,
        amountKes: 1000,
        exchangeRate: 5000000,
        message: 'Successfully credited 200000 satoshis to your wallet',
      });

      mockedBitcoinOperationsService.getExchangeRate.mockResolvedValue({
        success: true,
        rate: 5000000,
        currency: 'KES',
        timestamp: '2024-01-01T12:00:00Z',
      });

      const result = await webhookProcessor.processMpesaCallback(callback, signature);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('tx_123456789');
      expect(result.amountSats).toBe(200000);
      expect(result.amountKes).toBe(1000);
      expect(result.message).toBe('Successfully credited 200000 satoshis to your wallet');

      expect(mockedMpesaService.validateCallback).toHaveBeenCalledWith(callback, signature);
      expect(mockedMpesaService.processCallback).toHaveBeenCalledWith(callback);
      expect(mockedBitcoinOperationsService.creditBitcoin).toHaveBeenCalled();
    });

    it('should handle invalid signature', async () => {
      const callback = { Body: { stkCallback: {} } };
      const signature = 'invalid_signature';

      mockedMpesaService.validateCallback.mockReturnValue(false);

      const result = await webhookProcessor.processMpesaCallback(callback, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_SIGNATURE');
      expect(result.message).toBe('Invalid callback signature');
    });

    it('should handle failed MPesa transaction', async () => {
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

      const signature = 'valid_signature';

      mockedMpesaService.validateCallback.mockReturnValue(true);
      mockedMpesaService.processCallback.mockReturnValue({
        success: false,
        merchantRequestID: 'merchant_123',
        checkoutRequestID: 'checkout_123',
        resultCode: 1,
        resultDesc: 'Failed',
      });

      const result = await webhookProcessor.processMpesaCallback(callback, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('MPESA_TRANSACTION_FAILED');
      expect(result.message).toBe('Transaction failed: Failed');
    });

    it('should handle Bitcoin credit failure', async () => {
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
              ],
            },
          },
        },
      };

      const signature = 'valid_signature';

      mockedMpesaService.validateCallback.mockReturnValue(true);
      mockedMpesaService.processCallback.mockReturnValue({
        success: true,
        merchantRequestID: 'merchant_123',
        checkoutRequestID: 'checkout_123',
        resultCode: 0,
        resultDesc: 'Success',
        amount: 1000,
        mpesaReceiptNumber: 'MPE123456789',
        phoneNumber: '254712345678',
      });

      mockedBitcoinOperationsService.creditBitcoin.mockResolvedValue({
        success: false,
        transactionId: '',
        amountSats: 0,
        amountKes: 0,
        exchangeRate: 0,
        message: 'Bitcoin credit failed',
        error: 'INSUFFICIENT_FUNDS',
      });

      mockedBitcoinOperationsService.getExchangeRate.mockResolvedValue({
        success: true,
        rate: 5000000,
        currency: 'KES',
        timestamp: '2024-01-01T12:00:00Z',
      });

      const result = await webhookProcessor.processMpesaCallback(callback, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('BITCOIN_CREDIT_FAILED');
      expect(result.message).toBe('Bitcoin credit failed');
    });
  });

  describe('processAirtimeCallback', () => {
    it('should process successful airtime callback', async () => {
      const callback = {
        transactionId: 'airtime_123',
        status: 'success',
        amount: 100,
        phoneNumber: '254712345678',
        provider: 'safaricom',
      };

      const signature = 'valid_signature';

      const result = await webhookProcessor.processAirtimeCallback(callback, signature);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Airtime purchased successfully');
    });

    it('should handle failed airtime callback', async () => {
      const callback = {
        transactionId: 'airtime_123',
        status: 'failed',
        amount: 100,
        phoneNumber: '254712345678',
        provider: 'safaricom',
        message: 'Insufficient funds',
      };

      const signature = 'valid_signature';

      const result = await webhookProcessor.processAirtimeCallback(callback, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('AIRTIME_PURCHASE_FAILED');
      expect(result.message).toBe('Insufficient funds');
    });
  });

  describe('processMpesaPayoutCallback', () => {
    it('should process successful payout callback', async () => {
      const callback = {
        OriginatorConversationID: 'originator_123',
        ConversationID: 'conversation_123',
        ResultCode: 0,
        ResultDesc: 'Success',
      };

      const signature = 'valid_signature';

      mockedMpesaService.validateCallback.mockReturnValue(true);

      const result = await webhookProcessor.processMpesaPayoutCallback(callback, signature);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Payout completed successfully');
    });

    it('should handle failed payout callback', async () => {
      const callback = {
        OriginatorConversationID: 'originator_123',
        ConversationID: 'conversation_123',
        ResultCode: 1,
        ResultDesc: 'Failed',
      };

      const signature = 'valid_signature';

      mockedMpesaService.validateCallback.mockReturnValue(true);

      const result = await webhookProcessor.processMpesaPayoutCallback(callback, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('MPESA_PAYOUT_FAILED');
      expect(result.message).toBe('Failed');
    });
  });

  describe('healthCheck', () => {
    it('should return true when all services are healthy', async () => {
      mockedMpesaService.healthCheck.mockResolvedValue(true);

      const result = await webhookProcessor.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when services are unhealthy', async () => {
      mockedMpesaService.healthCheck.mockResolvedValue(false);

      const result = await webhookProcessor.healthCheck();

      expect(result).toBe(false);
    });
  });
});
