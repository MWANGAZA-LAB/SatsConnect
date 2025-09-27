import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage } from './secureStorage';
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
      const hasWallet = await secureStorage.hasWallet();
      this.authState.hasWallet = hasWallet;

      // Check if biometric is available and enabled
      const biometricAvailable = await LocalAuthentication.hasHardwareAsync();
      const biometricEnrolled = await LocalAuthentication.isEnrolledAsync();
      const preferences = await secureStorage.getUserPreferences();
      
      this.authState.biometricEnabled = biometricAvailable && 
        biometricEnrolled && 
        preferences?.biometricEnabled === true;

      // If no wallet, user needs to go through onboarding
      if (!hasWallet) {
        this.authState.isAuthenticated = false;
      } else {
        // Check if we have a valid auth token
        const token = await secureStorage.getAuthToken();
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
      // In a real app, you'd hash and compare the PIN
      // For now, we'll use a simple check
      const storedPin = await secureStorage.getUserPreferences();
      if (storedPin?.biometricEnabled && pin === '1234') { // Default PIN for demo
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

  public async login(token: string): Promise<boolean> {
    try {
      await secureStorage.saveAuthToken(token);
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
      await secureStorage.clearAuthToken();
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

      const preferences = await secureStorage.getUserPreferences() || {
        currency: 'KES',
        language: 'en',
        notifications: true,
        biometricEnabled: false,
        theme: 'light',
      };

      preferences.biometricEnabled = true;
      await secureStorage.saveUserPreferences(preferences);
      
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
      const preferences = await secureStorage.getUserPreferences();
      if (preferences) {
        preferences.biometricEnabled = false;
        await secureStorage.saveUserPreferences(preferences);
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
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      return { available, enrolled, types };
    } catch (error) {
      console.error('Failed to check biometric availability:', error);
      return { available: false, enrolled: false, types: [] };
    }
  }

  public async resetWallet(): Promise<boolean> {
    try {
      await secureStorage.clearAllData();
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
