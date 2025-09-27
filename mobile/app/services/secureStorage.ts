import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  WALLET_DATA: 'wallet_data',
  MNEMONIC: 'mnemonic',
  AUTH_TOKEN: 'auth_token',
  USER_PREFERENCES: 'user_preferences',
  TRANSACTIONS: 'transactions',
} as const;

export interface WalletData {
  nodeId: string;
  address: string;
  label: string;
  createdAt: string;
}

export interface UserPreferences {
  currency: 'KES' | 'USD' | 'EUR';
  language: 'en' | 'sw';
  notifications: boolean;
  biometricEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export interface TransactionData {
  id: string;
  type: 'send' | 'receive' | 'airtime' | 'bill';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  description?: string;
  paymentHash?: string;
  invoice?: string;
}

class SecureStorageService {
  // Wallet data (sensitive - stored in SecureStore)
  async saveWalletData(walletData: WalletData): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.WALLET_DATA, JSON.stringify(walletData));
      return true;
    } catch (error) {
      console.error('Failed to save wallet data:', error);
      return false;
    }
  }

  async getWalletData(): Promise<WalletData | null> {
    try {
      const data = await SecureStore.getItemAsync(STORAGE_KEYS.WALLET_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get wallet data:', error);
      return null;
    }
  }

  async clearWalletData(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_DATA);
      return true;
    } catch (error) {
      console.error('Failed to clear wallet data:', error);
      return false;
    }
  }

  // Mnemonic (most sensitive - stored in SecureStore)
  async saveMnemonic(mnemonic: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.MNEMONIC, mnemonic);
      return true;
    } catch (error) {
      console.error('Failed to save mnemonic:', error);
      return false;
    }
  }

  async getMnemonic(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.MNEMONIC);
    } catch (error) {
      console.error('Failed to get mnemonic:', error);
      return null;
    }
  }

  async clearMnemonic(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.MNEMONIC);
      return true;
    } catch (error) {
      console.error('Failed to clear mnemonic:', error);
      return false;
    }
  }

  // Auth token (sensitive - stored in SecureStore)
  async saveAuthToken(token: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
      return true;
    } catch (error) {
      console.error('Failed to save auth token:', error);
      return false;
    }
  }

  async getAuthToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  async clearAuthToken(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      return true;
    } catch (error) {
      console.error('Failed to clear auth token:', error);
      return false;
    }
  }

  // User preferences (non-sensitive - stored in AsyncStorage)
  async saveUserPreferences(preferences: UserPreferences): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
      return true;
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      return false;
    }
  }

  async getUserPreferences(): Promise<UserPreferences | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }

  // Transactions (non-sensitive - stored in AsyncStorage)
  async saveTransactions(transactions: TransactionData[]): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      return true;
    } catch (error) {
      console.error('Failed to save transactions:', error);
      return false;
    }
  }

  async getTransactions(): Promise<TransactionData[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get transactions:', error);
      return [];
    }
  }

  async addTransaction(transaction: TransactionData): Promise<boolean> {
    try {
      const transactions = await this.getTransactions();
      transactions.unshift(transaction); // Add to beginning
      await this.saveTransactions(transactions);
      return true;
    } catch (error) {
      console.error('Failed to add transaction:', error);
      return false;
    }
  }

  async updateTransaction(transactionId: string, updates: Partial<TransactionData>): Promise<boolean> {
    try {
      const transactions = await this.getTransactions();
      const index = transactions.findIndex(t => t.id === transactionId);
      if (index !== -1) {
        transactions[index] = { ...transactions[index], ...updates };
        await this.saveTransactions(transactions);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update transaction:', error);
      return false;
    }
  }

  // Clear all data (for logout/reset)
  async clearAllData(): Promise<boolean> {
    try {
      await Promise.all([
        this.clearWalletData(),
        this.clearMnemonic(),
        this.clearAuthToken(),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES),
        AsyncStorage.removeItem(STORAGE_KEYS.TRANSACTIONS),
      ]);
      return true;
    } catch (error) {
      console.error('Failed to clear all data:', error);
      return false;
    }
  }

  // Check if wallet exists
  async hasWallet(): Promise<boolean> {
    try {
      const walletData = await this.getWalletData();
      const mnemonic = await this.getMnemonic();
      return !!(walletData && mnemonic);
    } catch (error) {
      console.error('Failed to check wallet existence:', error);
      return false;
    }
  }
}

// Export singleton instance
export const secureStorage = new SecureStorageService();
export default secureStorage;
