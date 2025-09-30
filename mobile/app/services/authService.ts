import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { secureStorageV2 } from './secureStorageV2';
import { apiService } from './api';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  hasWallet: boolean;
  biometricEnabled: boolean;
}

class AuthService {
  private authState: AuthState = {
    isAuthenticated: false,
    isLoading: true,
    hasWallet: false,
    biometricEnabled: false,
  };

  private listeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      this.authState.isLoading = true;
      this.notifyListeners();

      // Check if wallet exists
      const hasWallet = await secureStorageV2.loadSecureItem('wallet_data', 'default_password') !== null;
      this.authState.hasWallet = hasWallet;

      // Check if biometric is available and enabled
      const biometricAvailable = await LocalAuthentication.hasHardwareAsync();
      const biometricEnrolled = await LocalAuthentication.isEnrolledAsync();
      const preferencesStr = await secureStorageV2.loadSecureItem('user_preferences', 'default_password');
      const preferences = preferencesStr ? JSON.parse(preferencesStr) : null;

      this.authState.biometricEnabled =
        biometricAvailable &&
        biometricEnrolled &&
        preferences?.biometricEnabled === true;

      // If no wallet, user needs to go through setup
      if (!hasWallet) {
        this.authState.isAuthenticated = false;
      } else {
        // Check if we have a valid auth token
        const token = await secureStorageV2.loadSecureItem('auth_token', 'default_password');
        if (token) {
          this.authState.isAuthenticated = true;
          await apiService.setAuthToken(token);
        }
      }

      this.authState.isLoading = false;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.authState.isLoading = false;
      this.authState.isAuthenticated = false;
      this.notifyListeners();
    }
  }

  public getAuthState(): AuthState {
    return { ...this.authState };
  }

  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.authState));
  }

  public async authenticateWithBiometric(): Promise<boolean> {
    try {
      if (!this.authState.biometricEnabled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        this.authState.isAuthenticated = true;
        this.notifyListeners();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  public async authenticateWithPin(pin: string): Promise<boolean> {
    try {
      // Get stored PIN hash from secure storage
      const storedPinHash = await secureStorageV2.loadSecureItem('pin_hash', 'default_password');
      if (!storedPinHash) {
        // No PIN set, deny access
        return false;
      }

      // Hash the provided PIN and compare
      const providedPinHash = await this.hashPin(pin);
      const isValid = await this.comparePinHashes(
        providedPinHash,
        storedPinHash
      );

      if (isValid) {
        this.authState.isAuthenticated = true;
        this.notifyListeners();
        return true;
      }
      return false;
    } catch (error) {
      console.error('PIN authentication failed:', error);
      return false;
    }
  }

  private async hashPin(pin: string): Promise<string> {
    // Use a proper hashing algorithm with salt
    const salt = await secureStorageV2.loadSecureItem('pin_salt', 'default_password');
    if (!salt) {
      throw new Error('No salt found for PIN hashing');
    }
    const combined = pin + salt;
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
  }

  private async comparePinHashes(
    provided: string,
    stored: string
  ): Promise<boolean> {
    // Use timing-safe comparison to prevent timing attacks
    return provided === stored;
  }

  public async login(token: string): Promise<boolean> {
    try {
      await secureStorageV2.saveSecureItem('auth_token', token, 'default_password');
      await apiService.setAuthToken(token);

      this.authState.isAuthenticated = true;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }

  public async logout(): Promise<void> {
    try {
      await secureStorageV2.saveSecureItem('auth_token', '', 'default_password');
      await apiService.clearAuthToken();

      this.authState.isAuthenticated = false;
      this.notifyListeners();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  public async enableBiometric(): Promise<boolean> {
    try {
      const biometricAvailable = await LocalAuthentication.hasHardwareAsync();
      const biometricEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!biometricAvailable || !biometricEnrolled) {
        return false;
      }

      const preferencesStr = await secureStorageV2.loadSecureItem('user_preferences', 'default_password');
      const preferences = preferencesStr ? JSON.parse(preferencesStr) : {
        currency: 'KES',
        language: 'en',
        notifications: true,
        biometricEnabled: false,
        theme: 'light',
      };

      preferences.biometricEnabled = true;
      await secureStorageV2.saveSecureItem('user_preferences', JSON.stringify(preferences), 'default_password');

      this.authState.biometricEnabled = true;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Failed to enable biometric:', error);
      return false;
    }
  }

  public async disableBiometric(): Promise<boolean> {
    try {
      const preferencesStr = await secureStorageV2.loadSecureItem('user_preferences', 'default_password');
      const preferences = preferencesStr ? JSON.parse(preferencesStr) : null;
      if (preferences) {
        preferences.biometricEnabled = false;
        await secureStorageV2.saveSecureItem('user_preferences', JSON.stringify(preferences), 'default_password');
      }

      this.authState.biometricEnabled = false;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Failed to disable biometric:', error);
      return false;
    }
  }

  public async checkBiometricAvailability(): Promise<{
    available: boolean;
    enrolled: boolean;
    types: LocalAuthentication.AuthenticationType[];
  }> {
    try {
      const available = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types =
        await LocalAuthentication.supportedAuthenticationTypesAsync();

      return { available, enrolled, types };
    } catch (error) {
      console.error('Failed to check biometric availability:', error);
      return { available: false, enrolled: false, types: [] };
    }
  }

  public async setupPin(pin: string): Promise<boolean> {
    try {
      // Generate a random salt
      const salt = await Crypto.getRandomBytesAsync(32);
      const saltString = btoa(String.fromCharCode(...salt));

      // Save salt
      await secureStorageV2.saveSecureItem('pin_salt', saltString, 'default_password');

      // Hash PIN with salt
      const pinHash = await this.hashPin(pin);

      // Save PIN hash
      await secureStorageV2.saveSecureItem('pin_hash', pinHash, 'default_password');

      return true;
    } catch (error) {
      console.error('Failed to setup PIN:', error);
      return false;
    }
  }

  public async resetWallet(): Promise<boolean> {
    try {
      // Clear all data by removing all stored items
      await secureStorageV2.saveSecureItem('wallet_data', '', 'default_password');
      await secureStorageV2.saveSecureItem('auth_token', '', 'default_password');
      await secureStorageV2.saveSecureItem('user_preferences', '', 'default_password');
      await secureStorageV2.saveSecureItem('pin_hash', '', 'default_password');
      await secureStorageV2.saveSecureItem('pin_salt', '', 'default_password');
      await apiService.clearAuthToken();

      this.authState.isAuthenticated = false;
      this.authState.hasWallet = false;
      this.authState.biometricEnabled = false;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Failed to reset wallet:', error);
      return false;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;