import axios, { AxiosResponse } from 'axios';

// HTTP client for Rust engine instead of gRPC
const RUST_ENGINE_BASE_URL = process.env.RUST_ENGINE_ADDR || 'http://127.0.0.1:50051';

export interface WalletResponse {
  success: boolean;
  error?: string;
  node_id?: string;
  address?: string;
  confirmed_sats?: number;
  lightning_sats?: number;
  invoice?: string;
  payment_hash?: string;
  status?: string;
}

export interface PaymentResponse {
  success: boolean;
  error?: string;
  payment_id?: string;
  status?: string;
  message?: string;
  amount_sats?: number;
  payment_hash?: string;
  timestamp?: string;
}

// HTTP client for wallet operations
export class WalletClient {
  private baseUrl: string;

  constructor(baseUrl = RUST_ENGINE_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async createWallet(label?: string, mnemonic?: string): Promise<WalletResponse> {
    try {
      const response: AxiosResponse<WalletResponse> = await axios.post(
        `${this.baseUrl}/api/wallet/create`,
        { label: label || 'default', mnemonic: mnemonic || '' }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to create wallet',
      };
    }
  }

  async getBalance(): Promise<WalletResponse> {
    try {
      const response: AxiosResponse<WalletResponse> = await axios.get(
        `${this.baseUrl}/api/wallet/balance`
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to get balance',
      };
    }
  }

  async newInvoice(amountSats: number, memo: string): Promise<WalletResponse> {
    try {
      const response: AxiosResponse<WalletResponse> = await axios.post(
        `${this.baseUrl}/api/wallet/invoice`,
        { amount_sats: amountSats, memo }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to create invoice',
      };
    }
  }

  async sendPayment(invoice: string): Promise<WalletResponse> {
    try {
      const response: AxiosResponse<WalletResponse> = await axios.post(
        `${this.baseUrl}/api/wallet/send`,
        { invoice }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to send payment',
      };
    }
  }
}

// HTTP client for payment operations
export class PaymentClient {
  private baseUrl: string;

  constructor(baseUrl = RUST_ENGINE_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async processPayment(
    paymentId: string,
    walletId: string,
    amountSats: number,
    invoice: string,
    description: string
  ): Promise<PaymentResponse> {
    try {
      const response: AxiosResponse<PaymentResponse> = await axios.post(
        `${this.baseUrl}/api/payments/process`,
        {
          payment_id: paymentId,
          wallet_id: walletId,
          amount_sats: amountSats,
          invoice,
          description,
        }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to process payment',
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    try {
      const response: AxiosResponse<PaymentResponse> = await axios.get(
        `${this.baseUrl}/api/payments/status/${paymentId}`
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to get payment status',
      };
    }
  }

  async processRefund(paymentId: string, amountSats: number): Promise<PaymentResponse> {
    try {
      const response: AxiosResponse<PaymentResponse> = await axios.post(
        `${this.baseUrl}/api/payments/refund`,
        { payment_id: paymentId, amount_sats: amountSats }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to process refund',
      };
    }
  }
}

// Legacy compatibility functions
export function createWalletClient(address = RUST_ENGINE_BASE_URL): WalletClient {
  return new WalletClient(address);
}

export function createPaymentClient(address = RUST_ENGINE_BASE_URL): PaymentClient {
  return new PaymentClient(address);
}

// Utility function to handle HTTP errors
export function handleHttpError(error: any): { success: boolean; error?: string; code?: number } {
  if (!error) {
    return { success: true };
  }

  return {
    success: false,
    error: error.message || 'Unknown HTTP error',
    code: error.response?.status || 500,
  };
}

// Health check function
export async function checkEngineHealth(address = RUST_ENGINE_BASE_URL): Promise<boolean> {
  try {
    // Simple TCP connection test to check if the gRPC server is listening
    const net = require('net');
    
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 5000;
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      // Extract host and port from address
      const [host, port] = address.replace('http://', '').split(':');
      socket.connect(parseInt(port) || 50051, host || '127.0.0.1');
    });
  } catch (error) {
    console.error('Engine health check failed:', error);
    return false;
  }
}
