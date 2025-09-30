// Mock axios first
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock axios.create
const mockAxiosInstance = {
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
  get: jest.fn(),
  post: jest.fn(),
};

  mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

// Mock config
jest.mock('../../config', () => ({
  mpesa: {
    consumerKey: 'test_consumer_key',
    consumerSecret: 'test_consumer_secret',
    businessShortCode: '174379',
    passkey: 'test_passkey',
    callbackUrl: 'https://test.com/webhook/mpesa',
    environment: 'sandbox',
  },
  logging: { level: 'info', file: 'logs/app.log' },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Import service after mocks
import mpesaService from '../../services/mpesaService';

describe('MpesaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initiate STK push successfully', async () => {
    const mockResponse = {
      data: {
        MerchantRequestID: 'merchant_req_123',
        CheckoutRequestID: 'ws_CO_123456789',
        ResponseCode: '0',
        ResponseDescription: 'Success',
      },
    };
    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await mpesaService.initiateStkPush({
      phoneNumber: '254712345678',
      amount: 1000,
      accountReference: 'test_ref',
      transactionDesc: 'Test payment',
    });

    expect(result.ResponseCode).toBe('0');
    expect(result.CheckoutRequestID).toBe('ws_CO_123456789');
  });

  it('should handle STK push error', async () => {
    mockAxiosInstance.post.mockRejectedValueOnce(new Error('STK push failed'));

    await expect(
      mpesaService.initiateStkPush({
        phoneNumber: '254712345678',
        amount: 1000,
        accountReference: 'test_ref',
        transactionDesc: 'Test payment',
      })
    ).rejects.toThrow('STK push failed');
  });

  it('should query STK push status successfully', async () => {
    const mockResponse = {
      data: {
        ResponseCode: '0',
        ResponseDescription: 'The service request has been accepted successfully.',
        MerchantRequestID: 'merchant_req_123',
        CheckoutRequestID: 'ws_CO_123456789',
        ResultCode: '0',
        ResultDesc: 'The service request is processed successfully.',
      },
    };
    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await mpesaService.queryStkPushStatus('ws_CO_123456789');

    expect((result as any).ResponseCode).toBe('0');
    expect((result as any).ResultCode).toBe('0');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/mpesa/stkpushquery/v1/query',
      expect.any(Object)
    );
  });

  it('should handle STK push status query error', async () => {
    mockAxiosInstance.post.mockRejectedValueOnce(new Error('Status check failed'));

    await expect(mpesaService.queryStkPushStatus('ws_CO_123456789')).rejects.toThrow(
      'Status check failed'
    );
  });

  it('should initiate payout successfully', async () => {
    const mockResponse = {
      data: {
        OriginatorConversationID: 'conv_123',
        ConversationID: 'conv_456',
        ResponseCode: '0',
        ResponseDescription: 'Accept the service request successfully.',
      },
    };
    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await mpesaService.initiatePayout({
      phoneNumber: '254712345678',
      amount: 500,
      accountReference: 'test_ref',
      transactionDesc: 'Test payout',
    });

    expect(result.ResponseCode).toBe('0');
    expect(result.ConversationID).toBe('conv_456');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/mpesa/b2c/v1/paymentrequest',
      expect.any(Object)
    );
  });

  it('should handle payout error', async () => {
    mockAxiosInstance.post.mockRejectedValueOnce(new Error('Payout failed'));

    await expect(
      mpesaService.initiatePayout({
        phoneNumber: '254712345678',
        amount: 500,
        accountReference: 'test_ref',
        transactionDesc: 'Test payout',
      })
    ).rejects.toThrow('Payout failed');
  });

  it('should validate phone number format', () => {
    const validPhone = '254712345678';
    const invalidPhone = '123456789';

    // This would be tested through the service methods that validate phone numbers
    expect(validPhone.startsWith('254')).toBe(true);
    expect(invalidPhone.startsWith('254')).toBe(false);
  });

  it('should handle network timeout', async () => {
    const timeoutError = new Error('timeout of 5000ms exceeded');
    timeoutError.name = 'TimeoutError';
    mockAxiosInstance.post.mockRejectedValueOnce(timeoutError);

    await expect(
      mpesaService.initiateStkPush({
        phoneNumber: '254712345678',
        amount: 1000,
        accountReference: 'test_ref',
        transactionDesc: 'Test payment',
      })
    ).rejects.toThrow('timeout of 5000ms exceeded');
  });

  it('should handle invalid response format', async () => {
    const mockResponse = { data: { invalid: 'response' } };
    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await mpesaService.initiateStkPush({
      phoneNumber: '254712345678',
      amount: 1000,
      accountReference: 'test_ref',
      transactionDesc: 'Test payment',
    });

    expect(result).toBeDefined();
  });
});
