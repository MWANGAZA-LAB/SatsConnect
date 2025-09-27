// Mock axios completely before any imports
jest.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
  };

  return {
    create: jest.fn(() => mockAxiosInstance),
    default: mockAxiosInstance,
  };
});

import { apiService } from '../api';

describe('ApiService', () => {
  const mockAxios = require('axios');
  const mockAxiosInstance = mockAxios.create();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance.get.mockClear();
    mockAxiosInstance.post.mockClear();
  });

  describe('checkHealth', () => {
    it('should return true when health check succeeds', async () => {
      const mockResponse = { data: { status: 'ok' } };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await apiService.checkHealth();
      expect(result).toBe(true);
    });

    it('should return false when health check fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await apiService.checkHealth();
      expect(result).toBe(false);
    });
  });

  describe('createWallet', () => {
    it('should create wallet successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            node_id: 'test_node_id',
            address: 'test_address',
          },
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiService.createWallet('test_label', 'test_mnemonic');
      
      expect(result.success).toBe(true);
      expect(result.data?.node_id).toBe('test_node_id');
      expect(result.data?.address).toBe('test_address');
    });

    it('should handle wallet creation error', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Wallet creation failed',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiService.createWallet('test_label', 'test_mnemonic');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet creation failed');
    });
  });

  describe('getBalance', () => {
    it('should get balance successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            confirmed_sats: 1000000,
            lightning_sats: 500000,
          },
        },
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await apiService.getBalance('test_wallet_id');
      
      expect(result.success).toBe(true);
      expect(result.data?.confirmed_sats).toBe(1000000);
      expect(result.data?.lightning_sats).toBe(500000);
    });
  });

  describe('createInvoice', () => {
    it('should create invoice successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            invoice: 'lnbc1000n1p...',
            payment_hash: 'test_hash',
          },
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiService.createInvoice(1000, 'test memo');
      
      expect(result.success).toBe(true);
      expect(result.data?.invoice).toBe('lnbc1000n1p...');
      expect(result.data?.payment_hash).toBe('test_hash');
    });
  });

  describe('sendPayment', () => {
    it('should send payment successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            payment_hash: 'test_hash',
            status: 'SUCCEEDED',
          },
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiService.sendPayment('lnbc1000n1p...');
      
      expect(result.success).toBe(true);
      expect(result.data?.payment_hash).toBe('test_hash');
      expect(result.data?.status).toBe('SUCCEEDED');
    });
  });

  describe('buyAirtime', () => {
    it('should buy airtime successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            invoice: 'lnbc1000n1p...',
            payment_hash: 'test_hash',
            status: 'PENDING',
          },
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiService.buyAirtime(1000, '+254700000000', 'safaricom');
      
      expect(result.success).toBe(true);
      expect(result.data?.invoice).toBe('lnbc1000n1p...');
      expect(result.data?.status).toBe('PENDING');
    });
  });
});