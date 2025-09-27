import { apiService } from './api';
import { secureStorage, WalletData, TransactionData } from './secureStorage';
import { authService } from './authService';

export interface WalletState {
  wallet: WalletData | null;
  balance: {
    confirmedSats: number;
    lightningSats: number;
    totalSats: number;
  };
  transactions: TransactionData[];
  isLoading: boolean;
  error: string | null;
}

class WalletService {
  private walletState: WalletState = {
    wallet: null,
    balance: {
      confirmedSats: 0,
      lightningSats: 0,
      totalSats: 0,
    },
    transactions: [],
    isLoading: false,
    error: null,
  };

  private listeners: ((state: WalletState) => void)[] = [];

  constructor() {
    this.initializeWallet();
  }

  private async initializeWallet() {
    try {
      this.walletState.isLoading = true;
      this.notifyListeners();

      // Load wallet data from secure storage
      const wallet = await secureStorage.getWalletData();
      if (wallet) {
        this.walletState.wallet = wallet;
        
        // Load balance
        await this.refreshBalance();
        
        // Load transactions
        await this.loadTransactions();
      }

      this.walletState.isLoading = false;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      this.walletState.error = 'Failed to initialize wallet';
      this.walletState.isLoading = false;
      this.notifyListeners();
    }
  }

  public getWalletState(): WalletState {
    return { ...this.walletState };
  }

  public subscribe(listener: (state: WalletState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.walletState));
  }

  public async createWallet(label?: string, mnemonic?: string): Promise<boolean> {
    try {
      this.walletState.isLoading = true;
      this.walletState.error = null;
      this.notifyListeners();

      // Generate JWT token for API authentication
      const token = this.generateAuthToken();
      await apiService.setAuthToken(token);

      // Create wallet via API
      const response = await apiService.createWallet(label, mnemonic);
      
      if (response.success && response.data) {
        const walletData: WalletData = {
          nodeId: response.data.node_id,
          address: response.data.address,
          label: label || 'mobile-wallet',
          createdAt: new Date().toISOString(),
        };

        // Save wallet data securely
        await secureStorage.saveWalletData(walletData);
        if (mnemonic) {
          await secureStorage.saveMnemonic(mnemonic);
        }

        this.walletState.wallet = walletData;
        
        // Refresh balance
        await this.refreshBalance();
        
        // Update auth state
        await authService.login(token);
      } else {
        this.walletState.error = response.error || 'Failed to create wallet';
        return false;
      }

      this.walletState.isLoading = false;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Failed to create wallet:', error);
      this.walletState.error = 'Failed to create wallet';
      this.walletState.isLoading = false;
      this.notifyListeners();
      return false;
    }
  }

  public async refreshBalance(): Promise<boolean> {
    try {
      if (!this.walletState.wallet) {
        return false;
      }

      const response = await apiService.getBalance(this.walletState.wallet.nodeId);
      
      if (response.success && response.data) {
        this.walletState.balance = {
          confirmedSats: response.data.confirmed_sats,
          lightningSats: response.data.lightning_sats,
          totalSats: response.data.confirmed_sats + response.data.lightning_sats,
        };
        this.notifyListeners();
        return true;
      } else {
        this.walletState.error = response.error || 'Failed to get balance';
        return false;
      }
    } catch (error) {
      console.error('Failed to refresh balance:', error);
      this.walletState.error = 'Failed to refresh balance';
      return false;
    }
  }

  public async createInvoice(amountSats: number, memo?: string): Promise<string | null> {
    try {
      const response = await apiService.createInvoice(amountSats, memo);
      
      if (response.success && response.data) {
        return response.data.invoice;
      } else {
        this.walletState.error = response.error || 'Failed to create invoice';
        return null;
      }
    } catch (error) {
      console.error('Failed to create invoice:', error);
      this.walletState.error = 'Failed to create invoice';
      return null;
    }
  }

  public async sendPayment(invoice: string, amountSats: number, description?: string): Promise<boolean> {
    try {
      this.walletState.isLoading = true;
      this.notifyListeners();

      const response = await apiService.sendPayment(invoice);
      
      if (response.success && response.data) {
        // Add transaction to local storage
        const transaction: TransactionData = {
          id: response.data.payment_hash,
          type: 'send',
          amount: amountSats,
          status: response.data.status === 'SUCCEEDED' ? 'completed' : 'pending',
          timestamp: new Date().toISOString(),
          description: description || 'Payment sent',
          paymentHash: response.data.payment_hash,
        };

        await this.addTransaction(transaction);
        
        // Refresh balance
        await this.refreshBalance();
        
        this.walletState.isLoading = false;
        this.notifyListeners();
        return true;
      } else {
        this.walletState.error = response.error || 'Failed to send payment';
        this.walletState.isLoading = false;
        this.notifyListeners();
        return false;
      }
    } catch (error) {
      console.error('Failed to send payment:', error);
      this.walletState.error = 'Failed to send payment';
      this.walletState.isLoading = false;
      this.notifyListeners();
      return false;
    }
  }

  public async buyAirtime(amountSats: number, phoneNumber: string, provider?: string): Promise<boolean> {
    try {
      this.walletState.isLoading = true;
      this.notifyListeners();

      const response = await apiService.buyAirtime(amountSats, phoneNumber, provider);
      
      if (response.success && response.data) {
        // Add transaction to local storage
        const transaction: TransactionData = {
          id: response.data.payment_hash,
          type: 'airtime',
          amount: amountSats,
          status: response.data.status === 'PENDING' ? 'pending' : 'completed',
          timestamp: new Date().toISOString(),
          description: `Airtime for ${phoneNumber}`,
          paymentHash: response.data.payment_hash,
          invoice: response.data.invoice,
        };

        await this.addTransaction(transaction);
        
        // Refresh balance
        await this.refreshBalance();
        
        this.walletState.isLoading = false;
        this.notifyListeners();
        return true;
      } else {
        this.walletState.error = response.error || 'Failed to buy airtime';
        this.walletState.isLoading = false;
        this.notifyListeners();
        return false;
      }
    } catch (error) {
      console.error('Failed to buy airtime:', error);
      this.walletState.error = 'Failed to buy airtime';
      this.walletState.isLoading = false;
      this.notifyListeners();
      return false;
    }
  }

  public async loadTransactions(): Promise<void> {
    try {
      const transactions = await secureStorage.getTransactions();
      this.walletState.transactions = transactions;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }

  private async addTransaction(transaction: TransactionData): Promise<void> {
    try {
      await secureStorage.addTransaction(transaction);
      this.walletState.transactions.unshift(transaction);
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  }

  public async updateTransaction(transactionId: string, updates: Partial<TransactionData>): Promise<boolean> {
    try {
      const success = await secureStorage.updateTransaction(transactionId, updates);
      if (success) {
        const index = this.walletState.transactions.findIndex(t => t.id === transactionId);
        if (index !== -1) {
          this.walletState.transactions[index] = { ...this.walletState.transactions[index], ...updates };
          this.notifyListeners();
        }
      }
      return success;
    } catch (error) {
      console.error('Failed to update transaction:', error);
      return false;
    }
  }

  public clearError(): void {
    this.walletState.error = null;
    this.notifyListeners();
  }

  private generateAuthToken(): string {
    // In a real app, this would be generated by the backend
    // For now, we'll create a simple JWT-like token
    const payload = {
      userId: 'mobile_user',
      timestamp: Date.now(),
    };
    
    return `Bearer ${btoa(JSON.stringify(payload))}`;
  }

  public async resetWallet(): Promise<boolean> {
    try {
      await authService.resetWallet();
      this.walletState = {
        wallet: null,
        balance: {
          confirmedSats: 0,
          lightningSats: 0,
          totalSats: 0,
        },
        transactions: [],
        isLoading: false,
        error: null,
      };
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Failed to reset wallet:', error);
      return false;
    }
  }
}

// Export singleton instance
export const walletService = new WalletService();
export default walletService;
