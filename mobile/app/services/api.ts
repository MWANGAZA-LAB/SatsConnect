import axios, { AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_BASE_URL = 'http://localhost:4000'; // Change to your orchestrator URL
const API_TIMEOUT = 10000; // 10 seconds

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface WalletData {
  node_id: string;
  address: string;
}

export interface BalanceData {
  confirmed_sats: number;
  lightning_sats: number;
}

export interface InvoiceData {
  invoice: string;
  payment_hash: string;
}

export interface PaymentData {
  payment_hash: string;
  status: string;
}

export interface AirtimeData {
  invoice: string;
  payment_hash: string;
  status: string;
}

export interface TransactionData {
  id: string;
  type: 'send' | 'receive' | 'airtime' | 'bill';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  description?: string;
  payment_hash?: string;
}

class ApiService {
  private api: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadAuthToken();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        if (this.authToken) {
          config.headers.Authorization = this.authToken;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  private async loadAuthToken() {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        this.authToken = token;
      }
    } catch (error) {
      console.error('Failed to load auth token:', error);
    }
  }

  public async setAuthToken(token: string) {
    this.authToken = token;
    try {
      await AsyncStorage.setItem('auth_token', token);
    } catch (error) {
      console.error('Failed to save auth token:', error);
    }
  }

  public async clearAuthToken() {
    this.authToken = null;
    try {
      await AsyncStorage.removeItem('auth_token');
    } catch (error) {
      console.error('Failed to clear auth token:', error);
    }
  }

  // Health check
  public async checkHealth(): Promise<boolean> {
    try {
      const response = await this.api.get('/health');
      return response.data.status === 'ok';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // Wallet operations
  public async createWallet(label?: string, mnemonic?: string): Promise<ApiResponse<WalletData>> {
    try {
      const response = await this.api.post('/api/wallet/create', {
        label: label || 'mobile-wallet',
        mnemonic: mnemonic || '',
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create wallet',
      };
    }
  }

  public async getBalance(walletId: string): Promise<ApiResponse<BalanceData>> {
    try {
      const response = await this.api.get(`/api/wallet/balance/${walletId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get balance',
      };
    }
  }

  public async createInvoice(amountSats: number, memo?: string): Promise<ApiResponse<InvoiceData>> {
    try {
      const response = await this.api.post('/api/wallet/invoice/new', {
        amount_sats: amountSats,
        memo: memo || '',
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create invoice',
      };
    }
  }

  public async sendPayment(invoice: string): Promise<ApiResponse<PaymentData>> {
    try {
      const response = await this.api.post('/api/wallet/payment/send', {
        invoice,
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to send payment',
      };
    }
  }

  public async buyAirtime(amountSats: number, phoneNumber: string, provider?: string): Promise<ApiResponse<AirtimeData>> {
    try {
      const response = await this.api.post('/api/wallet/airtime/buy', {
        amount_sats: amountSats,
        phone_number: phoneNumber,
        provider: provider || 'default',
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to buy airtime',
      };
    }
  }

  // Payment operations
  public async processPayment(
    walletId: string,
    amountSats: number,
    invoice: string,
    description?: string
  ): Promise<ApiResponse<TransactionData>> {
    try {
      const response = await this.api.post('/api/payments/process', {
        wallet_id: walletId,
        amount_sats: amountSats,
        invoice,
        description: description || '',
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to process payment',
      };
    }
  }

  public async getPaymentStatus(paymentId: string): Promise<ApiResponse<TransactionData>> {
    try {
      const response = await this.api.get(`/api/payments/${paymentId}/status`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get payment status',
      };
    }
  }

  public async refundPayment(paymentId: string, amountSats: number): Promise<ApiResponse<TransactionData>> {
    try {
      const response = await this.api.post(`/api/payments/${paymentId}/refund`, {
        amount_sats: amountSats,
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to refund payment',
      };
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
