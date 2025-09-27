import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import config from '../config';
import logger from '../utils/logger';

export interface MpesaAuthResponse {
  access_token: string;
  expires_in: string;
}

export interface StkPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl?: string;
}

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
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

export interface PayoutRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  occasion?: string;
}

export interface PayoutResponse {
  OriginatorConversationID: string;
  ConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

class MpesaService {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.api = axios.create({
      baseURL: config.mpesa.environment === 'production' 
        ? 'https://api.safaricom.co.ke' 
        : 'https://sandbox.safaricom.co.ke',
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use(
      async (config) => {
        await this.ensureValidToken();
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('MPesa API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  private async ensureValidToken(): Promise<void> {
    const now = Date.now();
    
    if (this.accessToken && now < this.tokenExpiry) {
      return;
    }

    await this.authenticate();
  }

  private async authenticate(): Promise<void> {
    try {
      const auth = Buffer.from(
        `${config.mpesa.consumerKey}:${config.mpesa.consumerSecret}`
      ).toString('base64');

      const response = await axios.get(
        `${this.api.defaults.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      const data: MpesaAuthResponse = response.data;
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (parseInt(data.expires_in) * 1000) - 60000; // 1 minute buffer

      logger.info('MPesa authentication successful', {
        expiresIn: data.expires_in,
      });
    } catch (error: any) {
      logger.error('MPesa authentication failed:', error.message);
      throw new Error('Failed to authenticate with MPesa API');
    }
  }

  private generateTimestamp(): string {
    return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  }

  private generatePassword(): string {
    const timestamp = this.generateTimestamp();
    const password = Buffer.from(
      `${config.mpesa.businessShortCode}${config.mpesa.passkey}${timestamp}`
    ).toString('base64');
    return password;
  }

  async initiateStkPush(request: StkPushRequest): Promise<StkPushResponse> {
    try {
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword();

      const payload = {
        BusinessShortCode: config.mpesa.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(request.amount),
        PartyA: request.phoneNumber,
        PartyB: config.mpesa.businessShortCode,
        PhoneNumber: request.phoneNumber,
        CallBackURL: request.callbackUrl || config.mpesa.callbackUrl,
        AccountReference: request.accountReference,
        TransactionDesc: request.transactionDesc,
      };

      logger.info('Initiating STK Push:', {
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        accountReference: request.accountReference,
      });

      const response = await this.api.post('/mpesa/stkpush/v1/processrequest', payload);
      
      const result: StkPushResponse = response.data;
      
      logger.info('STK Push initiated successfully:', {
        merchantRequestID: result.MerchantRequestID,
        checkoutRequestID: result.CheckoutRequestID,
        responseCode: result.ResponseCode,
      });

      return result;
    } catch (error: any) {
      logger.error('STK Push initiation failed:', {
        error: error.message,
        request,
      });
      throw new Error(`STK Push failed: ${error.response?.data?.errorMessage || error.message}`);
    }
  }

  async queryStkPushStatus(checkoutRequestID: string): Promise<any> {
    try {
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword();

      const payload = {
        BusinessShortCode: config.mpesa.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID,
      };

      const response = await this.api.post('/mpesa/stkpushquery/v1/query', payload);
      
      logger.info('STK Push status queried:', {
        checkoutRequestID,
        response: response.data,
      });

      return response.data;
    } catch (error: any) {
      logger.error('STK Push status query failed:', {
        error: error.message,
        checkoutRequestID,
      });
      throw new Error(`STK Push status query failed: ${error.message}`);
    }
  }

  async initiatePayout(request: PayoutRequest): Promise<PayoutResponse> {
    try {
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword();

      const payload = {
        InitiatorName: 'testapi',
        SecurityCredential: password, // In production, this should be encrypted
        CommandID: 'BusinessPayment',
        Amount: Math.round(request.amount),
        PartyA: config.mpesa.businessShortCode,
        PartyB: request.phoneNumber,
        Remarks: request.transactionDesc,
        QueueTimeOutURL: config.mpesa.callbackUrl,
        ResultURL: config.mpesa.callbackUrl,
        Occasion: request.occasion || 'Payment',
      };

      logger.info('Initiating payout:', {
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        accountReference: request.accountReference,
      });

      const response = await this.api.post('/mpesa/b2c/v1/paymentrequest', payload);
      
      const result: PayoutResponse = response.data;
      
      logger.info('Payout initiated successfully:', {
        originatorConversationID: result.OriginatorConversationID,
        conversationID: result.ConversationID,
        responseCode: result.ResponseCode,
      });

      return result;
    } catch (error: any) {
      logger.error('Payout initiation failed:', {
        error: error.message,
        request,
      });
      throw new Error(`Payout failed: ${error.response?.data?.errorMessage || error.message}`);
    }
  }

  validateCallback(callback: MpesaCallback, signature: string): boolean {
    try {
      // In production, implement proper HMAC signature validation
      // For now, we'll do basic validation
      const expectedSignature = crypto
        .createHmac('sha256', config.mpesa.consumerSecret)
        .update(JSON.stringify(callback))
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      logger.error('Callback validation failed:', error);
      return false;
    }
  }

  extractTransactionDetails(callback: MpesaCallback): {
    merchantRequestID: string;
    checkoutRequestID: string;
    resultCode: number;
    resultDesc: string;
    amount?: number;
    mpesaReceiptNumber?: string;
    transactionDate?: string;
    phoneNumber?: string;
  } {
    const stkCallback = callback.Body.stkCallback;
    const metadata = stkCallback.CallbackMetadata?.Item || [];

    const details: any = {
      merchantRequestID: stkCallback.MerchantRequestID,
      checkoutRequestID: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc,
    };

    metadata.forEach((item) => {
      switch (item.Name) {
        case 'Amount':
          details.amount = item.Value;
          break;
        case 'MpesaReceiptNumber':
          details.mpesaReceiptNumber = item.Value;
          break;
        case 'TransactionDate':
          details.transactionDate = item.Value;
          break;
        case 'PhoneNumber':
          details.phoneNumber = item.Value;
          break;
      }
    });

    return details;
  }
}

export default new MpesaService();
