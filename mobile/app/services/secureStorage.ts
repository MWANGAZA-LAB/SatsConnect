import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  WALLET_DATA: 'wallet_data',
  MNEMONIC: 'mnemonic',
  AUTH_TOKEN: 'auth_token',
  USER_PREFERENCES: 'user_preferences',
  TRANSACTIONS: 'transactions',
  PIN_HASH: 'pin_hash',
  PIN_SALT: 'pin_salt',
  ENCRYPTION_KEY: 'encryption_key',
  DEVICE_ID: 'device_id',
  SECURITY_SETTINGS: 'security_settings',
} as const;

// Security settings interface
export interface SecuritySettings {
  biometricEnabled: boolean;
  pinEnabled: boolean;
  autoLockTimeout: number; // in minutes
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
  lastUnlockTime: number;
  failedAttempts: number;
}

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
  private deviceId: string | null = null;

  constructor() {
    this.initializeDeviceId();
  }

  // Initialize device ID for additional security
  private async initializeDeviceId(): Promise<void> {
    try {
      let deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
      if (!deviceId) {
        deviceId = await Crypto.getRandomBytesAsync(32).then(bytes => 
          btoa(String.fromCharCode(...bytes))
        );
        await SecureStore.setItemAsync(STORAGE_KEYS.DEVICE_ID, deviceId!);
      }
      this.deviceId = deviceId;
    } catch (error) {
      console.error('Failed to initialize device ID:', error);
    }
  }

  // Generate encryption key for additional data protection
  private async getEncryptionKey(): Promise<string> {
    try {
      let key = await SecureStore.getItemAsync(STORAGE_KEYS.ENCRYPTION_KEY);
      if (!key) {
        key = await Crypto.getRandomBytesAsync(32).then(bytes => 
          btoa(String.fromCharCode(...bytes))
        );
        await SecureStore.setItemAsync(STORAGE_KEYS.ENCRYPTION_KEY, key!);
      }
      return key!;
    } catch (error) {
      console.error('Failed to get encryption key:', error);
      throw new Error('Encryption key not available');
    }
  }

  // Encrypt sensitive data before storage
  private async encryptData(data: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const deviceId = this.deviceId || '';
      const combinedKey = key + deviceId;
      
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        combinedKey,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      
      // Simple XOR encryption (for additional obfuscation)
      let encrypted = '';
      for (let i = 0; i < data.length; i++) {
        encrypted += String.fromCharCode(
          data.charCodeAt(i) ^ hash.charCodeAt(i % hash.length)
        );
      }
      
      return btoa(encrypted);
    } catch (error) {
      console.error('Failed to encrypt data:', error);
      return data; // Fallback to unencrypted
    }
  }

  // Decrypt sensitive data after retrieval
  private async decryptData(encryptedData: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const deviceId = this.deviceId || '';
      const combinedKey = key + deviceId;
      
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        combinedKey,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      
      const data = atob(encryptedData);
      let decrypted = '';
      for (let i = 0; i < data.length; i++) {
        decrypted += String.fromCharCode(
          data.charCodeAt(i) ^ hash.charCodeAt(i % hash.length)
        );
      }
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      return encryptedData; // Fallback to encrypted data
    }
  }

  // Wallet data (sensitive - stored in SecureStore)
  async saveWalletData(walletData: WalletData): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.WALLET_DATA,
        JSON.stringify(walletData)
      );
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

  // Mnemonic (most sensitive - stored in SecureStore with additional encryption)
  async saveMnemonic(mnemonic: string): Promise<boolean> {
    try {
      const encryptedMnemonic = await this.encryptData(mnemonic);
      await SecureStore.setItemAsync(STORAGE_KEYS.MNEMONIC, encryptedMnemonic);
      return true;
    } catch (error) {
      console.error('Failed to save mnemonic:', error);
      return false;
    }
  }

  async getMnemonic(): Promise<string | null> {
    try {
      const encryptedMnemonic = await SecureStore.getItemAsync(STORAGE_KEYS.MNEMONIC);
      if (!encryptedMnemonic) return null;
      
      // Try to decrypt, fallback to original if decryption fails
      try {
        return await this.decryptData(encryptedMnemonic);
      } catch {
        // If decryption fails, assume it's an old unencrypted mnemonic
        return encryptedMnemonic;
      }
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
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_PREFERENCES,
        JSON.stringify(preferences)
      );
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
      await AsyncStorage.setItem(
        STORAGE_KEYS.TRANSACTIONS,
        JSON.stringify(transactions)
      );
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

  async updateTransaction(
    transactionId: string,
    updates: Partial<TransactionData>
  ): Promise<boolean> {
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
        this.clearPinData(),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES),
        AsyncStorage.removeItem(STORAGE_KEYS.TRANSACTIONS),
      ]);
      return true;
    } catch (error) {
      console.error('Failed to clear all data:', error);
      return false;
    }
  }

  // PIN management (sensitive - stored in SecureStore)
  async savePinHash(pinHash: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.PIN_HASH, pinHash);
      return true;
    } catch (error) {
      console.error('Failed to save PIN hash:', error);
      return false;
    }
  }

  async getStoredPinHash(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.PIN_HASH);
    } catch (error) {
      console.error('Failed to get PIN hash:', error);
      return null;
    }
  }

  async savePinSalt(salt: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.PIN_SALT, salt);
      return true;
    } catch (error) {
      console.error('Failed to save PIN salt:', error);
      return false;
    }
  }

  async getPinSalt(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.PIN_SALT);
    } catch (error) {
      console.error('Failed to get PIN salt:', error);
      return null;
    }
  }

  async clearPinData(): Promise<boolean> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.PIN_HASH),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PIN_SALT),
      ]);
      return true;
    } catch (error) {
      console.error('Failed to clear PIN data:', error);
      return false;
    }
  }

  // Security settings management
  async saveSecuritySettings(settings: SecuritySettings): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.SECURITY_SETTINGS,
        JSON.stringify(settings)
      );
      return true;
    } catch (error) {
      console.error('Failed to save security settings:', error);
      return false;
    }
  }

  async getSecuritySettings(): Promise<SecuritySettings | null> {
    try {
      const data = await SecureStore.getItemAsync(STORAGE_KEYS.SECURITY_SETTINGS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get security settings:', error);
      return null;
    }
  }

  async updateSecuritySettings(updates: Partial<SecuritySettings>): Promise<boolean> {
    try {
      const currentSettings = await this.getSecuritySettings();
      const newSettings: SecuritySettings = { 
        ...currentSettings, 
        ...updates,
        biometricEnabled: updates.biometricEnabled ?? currentSettings.biometricEnabled,
        pinEnabled: updates.pinEnabled ?? currentSettings.pinEnabled,
        autoLockTimeout: updates.autoLockTimeout ?? currentSettings.autoLockTimeout,
        maxLoginAttempts: updates.maxLoginAttempts ?? currentSettings.maxLoginAttempts,
        lockoutDuration: updates.lockoutDuration ?? currentSettings.lockoutDuration,
        lastUnlockTime: updates.lastUnlockTime ?? currentSettings.lastUnlockTime,
        failedAttempts: updates.failedAttempts ?? currentSettings.failedAttempts,
      };
      return await this.saveSecuritySettings(newSettings);
    } catch (error) {
      console.error('Failed to update security settings:', error);
      return false;
    }
  }

  // Security validation methods
  async isDeviceSecure(): Promise<boolean> {
    try {
      // Check if device has secure storage available
      const testKey = 'security_test';
      const testValue = 'test_value';
      
      await SecureStore.setItemAsync(testKey, testValue);
      const retrievedValue = await SecureStore.getItemAsync(testKey);
      await SecureStore.deleteItemAsync(testKey);
      
      return retrievedValue === testValue;
    } catch (error) {
      console.error('Device security check failed:', error);
      return false;
    }
  }

  async validateSecurityIntegrity(): Promise<boolean> {
    try {
      const settings = await this.getSecuritySettings();
      if (!settings) return false;

      // Check if app is locked due to failed attempts
      const now = Date.now();
      const lockoutEndTime = settings.lastUnlockTime + (settings.lockoutDuration * 60 * 1000);
      
      if (settings.failedAttempts >= settings.maxLoginAttempts && now < lockoutEndTime) {
        return false; // Still in lockout period
      }

      return true;
    } catch (error) {
      console.error('Security integrity validation failed:', error);
      return false;
    }
  }

  async recordFailedAttempt(): Promise<void> {
    try {
      const settings = await this.getSecuritySettings();
      if (settings) {
        settings.failedAttempts += 1;
        await this.saveSecuritySettings(settings);
      }
    } catch (error) {
      console.error('Failed to record failed attempt:', error);
    }
  }

  async resetFailedAttempts(): Promise<void> {
    try {
      const settings = await this.getSecuritySettings();
      if (settings) {
        settings.failedAttempts = 0;
        settings.lastUnlockTime = Date.now();
        await this.saveSecuritySettings(settings);
      }
    } catch (error) {
      console.error('Failed to reset failed attempts:', error);
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
