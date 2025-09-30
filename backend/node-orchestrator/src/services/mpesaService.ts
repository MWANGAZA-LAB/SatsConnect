import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface MpesaCredentials {
  consumerKey: string;
  consumerSecret: string;
  businessShortCode: string;
  passkey: string;
  callbackUrl: string;
  environment: 'sandbox' | 'production';
}

export interface StkPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl?: string;
}

export interface StkPushResponse {
  success: boolean;
  merchantRequestID: string;
  checkoutRequestID: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
  error?: string;
}

export interface MpesaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

export interface AccessTokenResponse {
  access_token: string;
  expires_in: string;
}

export class MpesaService {
  private api: AxiosInstance;
  private credentials: MpesaCredentials;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.credentials = {
      consumerKey: config.mpesa.consumerKey,
      consumerSecret: config.mpesa.consumerSecret,
      businessShortCode: config.mpesa.businessShortCode,
      passkey: config.mpesa.passkey,
      callbackUrl: config.mpesa.callbackUrl,
      environment: config.mpesa.environment,
    };

    const baseURL = this.credentials.environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';

    this.api = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        logger.debug('MPesa API Request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data ? '***REDACTED***' : undefined,
        });
        return config;
      },
      (error) => {
        logger.error('MPesa API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.api.interceptors.response.use(
      (response) => {
        logger.debug('MPesa API Response:', {
          status: response.status,
          url: response.config.url,
          data: response.data ? '***REDACTED***' : undefined,
        });
        return response;
      },
      (error) => {
        logger.error('MPesa API Response Error:', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get access token for MPesa API authentication
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      logger.info('Requesting MPesa access token');

      const auth = Buffer.from(
        `${this.credentials.consumerKey}:${this.credentials.consumerSecret}`
      ).toString('base64');

      const response = await this.api.post<AccessTokenResponse>(
        '/oauth/v1/generate?grant_type=client_credentials',
        {},
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (parseInt(response.data.expires_in) * 1000) - 60000; // 1 minute buffer

      logger.info('MPesa access token obtained successfully');
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get MPesa access token:', error);
      throw new Error('Failed to authenticate with MPesa API');
    }
  }

  /**
   * Generate password for STK Push
   */
  private generatePassword(): string {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(
      `${this.credentials.businessShortCode}${this.credentials.passkey}${timestamp}`
    ).toString('base64');

    return password;
  }

  /**
   * Format phone number to MPesa format (254XXXXXXXXX)
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle different formats
    if (cleaned.startsWith('254')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return '254' + cleaned;
    } else {
      throw new Error('Invalid phone number format');
    }
  }

  /**
   * Initiate STK Push for buying Bitcoin
   */
  async initiateStkPush(request: StkPushRequest): Promise<StkPushResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = this.generatePassword();
      const phoneNumber = this.formatPhoneNumber(request.phoneNumber);

      logger.info('Initiating STK Push:', {
        phoneNumber: phoneNumber.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1***$3$4'),
        amount: request.amount,
        accountReference: request.accountReference,
      });

      const stkPushData = {
        BusinessShortCode: this.credentials.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(request.amount),
        PartyA: phoneNumber,
        PartyB: this.credentials.businessShortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: request.callbackUrl || this.credentials.callbackUrl,
        AccountReference: request.accountReference,
        TransactionDesc: request.transactionDesc,
      };

      const response = await this.api.post(
        '/mpesa/stkpush/v1/processrequest',
        stkPushData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = response.data;

      if (result.ResponseCode === '0') {
        logger.info('STK Push initiated successfully:', {
          merchantRequestID: result.MerchantRequestID,
          checkoutRequestID: result.CheckoutRequestID,
        });

        return {
          success: true,
          merchantRequestID: result.MerchantRequestID,
          checkoutRequestID: result.CheckoutRequestID,
          responseCode: result.ResponseCode,
          responseDescription: result.ResponseDescription,
          customerMessage: result.CustomerMessage,
        };
      } else {
        logger.error('STK Push failed:', {
          responseCode: result.ResponseCode,
          responseDescription: result.ResponseDescription,
        });

        return {
          success: false,
          merchantRequestID: '',
          checkoutRequestID: '',
          responseCode: result.ResponseCode,
          responseDescription: result.ResponseDescription,
          customerMessage: result.CustomerMessage || 'Transaction failed',
          error: result.ResponseDescription,
        };
      }
    } catch (error) {
      logger.error('STK Push initiation failed:', error);
      return {
        success: false,
        merchantRequestID: '',
        checkoutRequestID: '',
        responseCode: 'ERROR',
        responseDescription: 'Internal server error',
        customerMessage: 'Unable to process request. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Query STK Push status
   */
  async queryStkPushStatus(checkoutRequestID: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = this.generatePassword();

      const queryData = {
        BusinessShortCode: this.credentials.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID,
      };

      const response = await this.api.post(
        '/mpesa/stkpushquery/v1/query',
        queryData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('STK Push query failed:', error);
      throw error;
    }
  }

  /**
   * Validate MPesa callback signature
   */
  validateCallback(callback: MpesaCallback, signature: string): boolean {
    try {
      // In production, you should validate the signature using your passkey
      // For now, we'll do basic validation
      if (!callback.Body?.stkCallback) {
        return false;
      }

      // Additional validation can be added here
      return true;
    } catch (error) {
      logger.error('Callback validation failed:', error);
      return false;
    }
  }

  /**
   * Process MPesa callback and extract transaction details
   */
  processCallback(callback: MpesaCallback): {
    success: boolean;
    merchantRequestID: string;
    checkoutRequestID: string;
    resultCode: number;
    resultDesc: string;
    amount?: number;
    mpesaReceiptNumber?: string;
    transactionDate?: string;
    phoneNumber?: string;
  } {
    try {
      const stkCallback = callback.Body.stkCallback;
      
      const result = {
        success: stkCallback.ResultCode === 0,
        merchantRequestID: stkCallback.MerchantRequestID,
        checkoutRequestID: stkCallback.CheckoutRequestID,
        resultCode: stkCallback.ResultCode,
        resultDesc: stkCallback.ResultDesc,
      };

      // Extract additional details from CallbackMetadata
      if (stkCallback.CallbackMetadata?.Item) {
        for (const item of stkCallback.CallbackMetadata.Item) {
          switch (item.Name) {
            case 'Amount':
              result.amount = typeof item.Value === 'string' ? parseFloat(item.Value) : item.Value as number;
              break;
            case 'MpesaReceiptNumber':
              result.mpesaReceiptNumber = item.Value as string;
              break;
            case 'TransactionDate':
              result.transactionDate = item.Value as string;
              break;
            case 'PhoneNumber':
              result.phoneNumber = item.Value as string;
              break;
          }
        }
      }

      logger.info('MPesa callback processed:', {
        success: result.success,
        merchantRequestID: result.merchantRequestID,
        checkoutRequestID: result.checkoutRequestID,
        amount: result.amount,
        mpesaReceiptNumber: result.mpesaReceiptNumber,
      });

      return result;
    } catch (error) {
      logger.error('Failed to process MPesa callback:', error);
      throw error;
    }
  }

  /**
   * Get MPesa transaction limits
   */
  getTransactionLimits(): {
    minAmount: number;
    maxAmount: number;
    dailyLimit: number;
    currency: string;
  } {
    return {
      minAmount: 1,
      maxAmount: 150000,
      dailyLimit: 300000,
      currency: 'KES',
    };
  }

  /**
   * Health check for MPesa service
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      logger.error('MPesa health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const mpesaService = new MpesaService();