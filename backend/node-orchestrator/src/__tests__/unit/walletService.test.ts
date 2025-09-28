import { jest } from '@jest/globals';
import walletService from '../../services/walletService';
import grpcClientService from '../../services/grpcClient';

// Mock the gRPC client service
jest.mock('../../services/grpcClient', () => ({
  getClients: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

const mockGrpcClientService = grpcClientService as jest.Mocked<typeof grpcClientService>;

describe('WalletService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createWallet', () => {
    it('should create wallet successfully with generated mnemonic', async () => {
      const mockClients = {
        walletClient: {
          CreateWallet: jest.fn((request: any, callback: any) => {
            callback(null, {
              node_id: 'test_node_id_123',
              address: 'tb1qtest123456789',
            });
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.createWallet({
        label: 'test-wallet',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        node_id: 'test_node_id_123',
        address: 'tb1qtest123456789',
      });
      expect(result.error).toBeUndefined();
    });

    it('should create wallet successfully with provided mnemonic', async () => {
      const mockClients = {
        walletClient: {
          CreateWallet: jest.fn((request: any, callback: any) => {
            callback(null, {
              node_id: 'test_node_id_456',
              address: 'tb1qtest456789012',
            });
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.createWallet({
        label: 'test-wallet-2',
        mnemonic:
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        node_id: 'test_node_id_456',
        address: 'tb1qtest456789012',
      });
    });

    it('should handle gRPC errors', async () => {
      const mockClients = {
        walletClient: {
          CreateWallet: jest.fn((request: any, callback: any) => {
            callback(new Error('gRPC connection failed'), null);
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.createWallet({
        label: 'test-wallet',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('gRPC call failed: gRPC connection failed');
      expect(result.data).toBeUndefined();
    });
  });

  describe('getBalance', () => {
    it('should get balance successfully', async () => {
      const mockClients = {
        walletClient: {
          GetBalance: jest.fn((request: any, callback: any) => {
            callback(null, {
              confirmed_sats: 1000000,
              lightning_sats: 500000,
            });
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.getBalance();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        confirmed_sats: 1000000,
        lightning_sats: 500000,
      });
    });

    it('should handle gRPC errors', async () => {
      const mockClients = {
        walletClient: {
          GetBalance: jest.fn((request: any, callback: any) => {
            callback(new Error('Service unavailable'), null);
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.getBalance();

      expect(result.success).toBe(false);
      expect(result.error).toBe('gRPC call failed: Service unavailable');
    });
  });

  describe('newInvoice', () => {
    it('should create invoice successfully', async () => {
      const mockClients = {
        walletClient: {
          NewInvoice: jest.fn((request: any, callback: any) => {
            callback(null, {
              invoice: 'lnbc1000u1p3k2v5cpp5test',
              payment_hash: 'test_payment_hash_123',
            });
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.newInvoice({
        amount_sats: 1000,
        memo: 'Test invoice',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        invoice: 'lnbc1000u1p3k2v5cpp5test',
        payment_hash: 'test_payment_hash_123',
      });
    });

    it('should handle gRPC errors', async () => {
      const mockClients = {
        walletClient: {
          NewInvoice: jest.fn((request: any, callback: any) => {
            callback(new Error('Invalid amount'), null);
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.newInvoice({
        amount_sats: -100,
        memo: 'Invalid invoice',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('gRPC call failed: Invalid amount');
    });
  });

  describe('sendPayment', () => {
    it('should send payment successfully', async () => {
      const mockClients = {
        walletClient: {
          SendPayment: jest.fn((request: any, callback: any) => {
            callback(null, {
              payment_hash: 'sent_payment_hash_123',
              status: 'SUCCEEDED',
            });
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.sendPayment({
        invoice: 'lnbc1000u1p3k2v5cpp5test',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        payment_hash: 'sent_payment_hash_123',
        status: 'SUCCEEDED',
      });
    });

    it('should handle gRPC errors', async () => {
      const mockClients = {
        walletClient: {
          SendPayment: jest.fn((request: any, callback: any) => {
            callback(new Error('Insufficient funds'), null);
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.sendPayment({
        invoice: 'lnbc1000u1p3k2v5cpp5test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('gRPC call failed: Insufficient funds');
    });
  });

  describe('buyAirtime', () => {
    it('should buy airtime successfully', async () => {
      const mockClients = {
        walletClient: {
          BuyAirtime: jest.fn((request: any, callback: any) => {
            callback(null, {
              invoice: 'lnbc500u1p3k2v5cpp5airtime',
              payment_hash: 'airtime_payment_hash_123',
              status: 'PENDING',
            });
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.buyAirtime({
        amount_sats: 500,
        phone_number: '+1234567890',
        provider: 'TestProvider',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        invoice: 'lnbc500u1p3k2v5cpp5airtime',
        payment_hash: 'airtime_payment_hash_123',
        status: 'PENDING',
      });
    });

    it('should handle gRPC errors', async () => {
      const mockClients = {
        walletClient: {
          BuyAirtime: jest.fn((request: any, callback: any) => {
            callback(new Error('Invalid phone number'), null);
          }),
        },
        paymentClient: {},
      };

      mockGrpcClientService.getClients.mockReturnValue(mockClients as any);

      const result = await walletService.buyAirtime({
        amount_sats: 500,
        phone_number: 'invalid',
        provider: 'TestProvider',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('gRPC call failed: Invalid phone number');
    });
  });
});
