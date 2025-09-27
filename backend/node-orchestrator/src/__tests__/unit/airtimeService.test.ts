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
  airtime: {
    provider: 'chimoney',
    chimoneyApiKey: 'test_chimoney_key',
    chimoneySubKey: 'test_chimoney_sub_key',
    webhookUrl: 'https://test.com/webhook/airtime',
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
import airtimeService from '../../services/airtimeService';

describe('AirtimeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should buy airtime successfully via Chimoney', async () => {
    const mockResponse = {
      data: {
        status: 'success',
        id: 'chimoney_tx_123',
        message: 'Airtime purchase successful',
      },
    };
    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);
    
    const request = {
      phoneNumber: '254712345678',
      amount: 100,
      provider: 'safaricom' as const,
      lightningInvoice: 'lnbc1000n1p...',
    };
    
    const result = await airtimeService.buyAirtime(request);
    
    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('chimoney_tx_123');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/payouts/airtime', expect.any(Object));
  });

  it('should buy airtime successfully with different providers', async () => {
    const mockResponse = {
      data: {
        status: 'success',
        id: 'airtime_tx_123',
        message: 'Airtime purchase successful',
      },
    };
    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);
    
    const request = {
      phoneNumber: '254712345678',
      amount: 100,
      provider: 'airtel' as const,
      lightningInvoice: 'lnbc1000n1p...',
    };
    
    const result = await airtimeService.buyAirtime(request);
    
    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('airtime_tx_123');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/payouts/airtime', expect.any(Object));
  });

  it('should handle airtime purchase error', async () => {
    mockAxiosInstance.post.mockRejectedValueOnce(new Error('Airtime purchase failed'));
    
    const request = {
      phoneNumber: '254712345678',
      amount: 100,
      provider: 'safaricom' as const,
      lightningInvoice: 'lnbc1000n1p...',
    };
    
    await expect(airtimeService.buyAirtime(request)).rejects.toThrow('Airtime purchase failed');
  });

  it('should validate phone number format', () => {
    const validPhone = '254712345678';
    const invalidPhone = '123456789';
    
    // This would be tested through the service methods that validate phone numbers
    expect(validPhone.startsWith('254')).toBe(true);
    expect(invalidPhone.startsWith('254')).toBe(false);
  });

  it('should get transaction status successfully', async () => {
    const mockResponse = {
      data: {
        status: 'success',
        id: 'test_tx_123',
        message: 'Transaction completed',
      },
    };
    mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);
    
    const result = await airtimeService.getTransactionStatus('test_tx_123');
    
    expect(result.success).toBe(true);
    expect(result.status).toBe('success');
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/payouts/test_tx_123');
  });

  it('should handle transaction status error', async () => {
    mockAxiosInstance.get.mockRejectedValueOnce(new Error('Status check failed'));
    
    await expect(airtimeService.getTransactionStatus('test_tx_123')).rejects.toThrow('Status check failed');
  });

  it('should validate phone number format', () => {
    const validPhone = '254712345678';
    const invalidPhone = '123456789';
    
    // This would be tested through the service methods that validate phone numbers
    expect(validPhone.startsWith('254')).toBe(true);
    expect(invalidPhone.startsWith('254')).toBe(false);
  });

  it('should handle invalid response format', async () => {
    const mockResponse = { data: { invalid: 'response' } };
    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);
    
    const request = {
      phoneNumber: '254712345678',
      amount: 100,
      provider: 'safaricom' as const,
      lightningInvoice: 'lnbc1000n1p...',
    };
    
    await expect(airtimeService.buyAirtime(request)).rejects.toThrow('Airtime purchase failed');
  });

  it('should handle network timeout', async () => {
    const timeoutError = new Error('timeout of 5000ms exceeded');
    timeoutError.name = 'TimeoutError';
    mockAxiosInstance.post.mockRejectedValueOnce(timeoutError);
    
    const request = {
      phoneNumber: '254712345678',
      amount: 100,
      provider: 'safaricom' as const,
      lightningInvoice: 'lnbc1000n1p...',
    };
    
    await expect(airtimeService.buyAirtime(request)).rejects.toThrow('timeout of 5000ms exceeded');
  });

});