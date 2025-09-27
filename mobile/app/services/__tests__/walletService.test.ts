import { walletService } from '../walletService';
import { apiService } from '../api';
import { secureStorage } from '../secureStorage';

// Mock dependencies
jest.mock('../api');
jest.mock('../secureStorage');

const mockedApiService = apiService as jest.Mocked<typeof apiService>;
const mockedSecureStorage = secureStorage as jest.Mocked<typeof secureStorage>;

describe('WalletService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset wallet service state
    jest.spyOn(walletService, 'getWalletState').mockReturnValue({
      wallet: null,
      balance: {
        confirmedSats: 0,
        lightningSats: 0,
        totalSats: 0,
      },
      transactions: [],
      isLoading: false,
      error: null,
    });
  });

  describe('createWallet', () => {
    it('should create wallet successfully', async () => {
      const mockWalletData = {
        nodeId: 'test_node_id',
        address: 'test_address',
        label: 'test_label',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      mockedApiService.createWallet.mockResolvedValue({
        success: true,
        data: {
          node_id: 'test_node_id',
          address: 'test_address',
        },
      });

      mockedApiService.getBalance.mockResolvedValue({
        success: true,
        data: {
          confirmed_sats: 1000000,
          lightning_sats: 500000,
        },
      });

      mockedSecureStorage.saveWalletData.mockResolvedValue(true);
      mockedSecureStorage.saveMnemonic.mockResolvedValue(true);

      const result = await walletService.createWallet('test_label', 'test_mnemonic');

      expect(result).toBe(true);
      expect(mockedApiService.createWallet).toHaveBeenCalledWith('test_label', 'test_mnemonic');
      expect(mockedSecureStorage.saveWalletData).toHaveBeenCalled();
      expect(mockedSecureStorage.saveMnemonic).toHaveBeenCalledWith('test_mnemonic');
    });

    it('should handle wallet creation failure', async () => {
      mockedApiService.createWallet.mockResolvedValue({
        success: false,
        error: 'Creation failed',
      });

      const result = await walletService.createWallet('test_label', 'test_mnemonic');

      expect(result).toBe(false);
    });
  });

  describe('refreshBalance', () => {
    it('should refresh balance successfully', async () => {
      const mockWallet = {
        nodeId: 'test_node_id',
        address: 'test_address',
        label: 'test_label',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      jest.spyOn(walletService, 'getWalletState').mockReturnValue({
        wallet: mockWallet,
        balance: {
          confirmedSats: 0,
          lightningSats: 0,
          totalSats: 0,
        },
        transactions: [],
        isLoading: false,
        error: null,
      });

      mockedApiService.getBalance.mockResolvedValue({
        success: true,
        data: {
          confirmed_sats: 1000000,
          lightning_sats: 500000,
        },
      });

      const result = await walletService.refreshBalance();

      expect(result).toBe(true);
      expect(mockedApiService.getBalance).toHaveBeenCalledWith('test_node_id');
    });

    it('should handle balance refresh failure', async () => {
      const mockWallet = {
        nodeId: 'test_node_id',
        address: 'test_address',
        label: 'test_label',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      jest.spyOn(walletService, 'getWalletState').mockReturnValue({
        wallet: mockWallet,
        balance: {
          confirmedSats: 0,
          lightningSats: 0,
          totalSats: 0,
        },
        transactions: [],
        isLoading: false,
        error: null,
      });

      mockedApiService.getBalance.mockResolvedValue({
        success: false,
        error: 'Balance fetch failed',
      });

      const result = await walletService.refreshBalance();

      expect(result).toBe(false);
    });
  });

  describe('createInvoice', () => {
    it('should create invoice successfully', async () => {
      mockedApiService.createInvoice.mockResolvedValue({
        success: true,
        data: {
          invoice: 'lnbc1000n1p...',
          payment_hash: 'test_hash',
        },
      });

      const result = await walletService.createInvoice(1000, 'test memo');

      expect(result).toBe('lnbc1000n1p...');
      expect(mockedApiService.createInvoice).toHaveBeenCalledWith(1000, 'test memo');
    });

    it('should handle invoice creation failure', async () => {
      mockedApiService.createInvoice.mockResolvedValue({
        success: false,
        error: 'Invoice creation failed',
      });

      const result = await walletService.createInvoice(1000, 'test memo');

      expect(result).toBe(null);
    });
  });

  describe('sendPayment', () => {
    it('should send payment successfully', async () => {
      mockedApiService.sendPayment.mockResolvedValue({
        success: true,
        data: {
          payment_hash: 'test_hash',
          status: 'SUCCEEDED',
        },
      });

      mockedSecureStorage.addTransaction.mockResolvedValue(true);

      const result = await walletService.sendPayment('lnbc1000n1p...', 1000, 'test payment');

      expect(result).toBe(true);
      expect(mockedApiService.sendPayment).toHaveBeenCalledWith('lnbc1000n1p...');
      expect(mockedSecureStorage.addTransaction).toHaveBeenCalled();
    });

    it('should handle payment failure', async () => {
      mockedApiService.sendPayment.mockResolvedValue({
        success: false,
        error: 'Payment failed',
      });

      const result = await walletService.sendPayment('lnbc1000n1p...', 1000, 'test payment');

      expect(result).toBe(false);
    });
  });

  describe('buyAirtime', () => {
    it('should buy airtime successfully', async () => {
      mockedApiService.buyAirtime.mockResolvedValue({
        success: true,
        data: {
          invoice: 'lnbc1000n1p...',
          payment_hash: 'test_hash',
          status: 'PENDING',
        },
      });

      mockedSecureStorage.addTransaction.mockResolvedValue(true);

      const result = await walletService.buyAirtime(1000, '+254700000000', 'safaricom');

      expect(result).toBe(true);
      expect(mockedApiService.buyAirtime).toHaveBeenCalledWith(1000, '+254700000000', 'safaricom');
      expect(mockedSecureStorage.addTransaction).toHaveBeenCalled();
    });

    it('should handle airtime purchase failure', async () => {
      mockedApiService.buyAirtime.mockResolvedValue({
        success: false,
        error: 'Airtime purchase failed',
      });

      const result = await walletService.buyAirtime(1000, '+254700000000', 'safaricom');

      expect(result).toBe(false);
    });
  });
});
