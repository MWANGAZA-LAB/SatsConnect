import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import config from '../config';
import logger from '../utils/logger';

export interface AirtimeRequest {
  phoneNumber: string;
  amount: number;
  provider: 'safaricom' | 'airtel' | 'telkom';
  reference?: string;
}

export interface AirtimeResponse {
  success: boolean;
  transactionId: string;
  reference: string;
  amount: number;
  phoneNumber: string;
  provider: string;
  status: 'pending' | 'success' | 'failed';
  message?: string;
}

export interface AirtimeCallback {
  transactionId: string;
  reference: string;
  status: 'success' | 'failed';
  amount: number;
  phoneNumber: string;
  provider: string;
  message?: string;
  timestamp: string;
}

class AirtimeService {
  private chimoneyApi: AxiosInstance;
  private kotanipayApi: AxiosInstance;
  private bitnobApi: AxiosInstance;

  constructor() {
    this.chimoneyApi = axios.create({
      baseURL: 'https://api.chimoney.io/v0.2',
      timeout: 30000,
      headers: {
        'X-API-KEY': config.airtime.chimoneyApiKey,
        'Content-Type': 'application/json',
      },
    });

    this.kotanipayApi = axios.create({
      baseURL: 'https://api.kotanipay.com/v1',
      timeout: 30000,
    });

    this.bitnobApi = axios.create({
      baseURL: 'https://api.bitnob.co/v1',
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    [this.chimoneyApi, this.kotanipayApi, this.bitnobApi].forEach((api) => {
      api.interceptors.response.use(
        (response) => response,
        (error) => {
          logger.error('Airtime API Error:', {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
          });
          return Promise.reject(error);
        }
      );
    });
  }

  async buyAirtime(request: AirtimeRequest): Promise<AirtimeResponse> {
    switch (config.airtime.provider) {
      case 'chimoney':
        return this.buyAirtimeChimoney(request);
      case 'kotanipay':
        return this.buyAirtimeKotanipay(request);
      case 'bitnob':
        return this.buyAirtimeBitnob(request);
      default:
        throw new Error(`Unsupported airtime provider: ${config.airtime.provider}`);
    }
  }

  private async buyAirtimeChimoney(request: AirtimeRequest): Promise<AirtimeResponse> {
    try {
      const reference =
        request.reference || `airtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const payload = {
        subAccount: config.airtime.chimoneySubKey,
        type: 'airtime',
        countryToSend: 'KE',
        currency: 'KES',
        amount: request.amount,
        phoneNumber: request.phoneNumber,
        provider: this.mapProviderToChimoney(request.provider),
        reference: reference,
        webhook: config.airtime.webhookUrl,
      };

      logger.info('Buying airtime via Chimoney:', {
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        provider: request.provider,
        reference,
      });

      const response = await this.chimoneyApi.post('/payouts/airtime', payload);

      const result = response.data;

      if (result.status === 'success') {
        logger.info('Airtime purchase successful via Chimoney:', {
          transactionId: result.id,
          reference,
          amount: request.amount,
        });

        return {
          success: true,
          transactionId: result.id,
          reference,
          amount: request.amount,
          phoneNumber: request.phoneNumber,
          provider: request.provider,
          status: 'success',
          message: result.message,
        };
      } else {
        throw new Error(result.message || 'Airtime purchase failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseError = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      logger.error('Chimoney airtime purchase failed:', {
        error: errorMessage,
        request,
      });
      throw new Error(`Airtime purchase failed: ${responseError || errorMessage}`);
    }
  }

  private async buyAirtimeKotanipay(request: AirtimeRequest): Promise<AirtimeResponse> {
    try {
      const reference =
        request.reference || `airtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const payload = {
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        provider: this.mapProviderToKotanipay(request.provider),
        reference,
        callbackUrl: config.airtime.webhookUrl,
      };

      logger.info('Buying airtime via KotaniPay:', {
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        provider: request.provider,
        reference,
      });

      const response = await this.kotanipayApi.post('/airtime/purchase', payload);

      const result = response.data;

      logger.info('Airtime purchase initiated via KotaniPay:', {
        transactionId: result.transactionId,
        reference,
        status: result.status,
      });

      return {
        success: true,
        transactionId: result.transactionId,
        reference,
        amount: request.amount,
        phoneNumber: request.phoneNumber,
        provider: request.provider,
        status: result.status === 'completed' ? 'success' : 'pending',
        message: result.message,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseError = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      logger.error('KotaniPay airtime purchase failed:', {
        error: errorMessage,
        request,
      });
      throw new Error(`Airtime purchase failed: ${responseError || errorMessage}`);
    }
  }

  private async buyAirtimeBitnob(request: AirtimeRequest): Promise<AirtimeResponse> {
    try {
      const reference =
        request.reference || `airtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const payload = {
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        provider: this.mapProviderToBitnob(request.provider),
        reference,
        webhookUrl: config.airtime.webhookUrl,
      };

      logger.info('Buying airtime via Bitnob:', {
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        provider: request.provider,
        reference,
      });

      const response = await this.bitnobApi.post('/airtime/purchase', payload);

      const result = response.data;

      logger.info('Airtime purchase initiated via Bitnob:', {
        transactionId: result.id,
        reference,
        status: result.status,
      });

      return {
        success: true,
        transactionId: result.id,
        reference,
        amount: request.amount,
        phoneNumber: request.phoneNumber,
        provider: request.provider,
        status: result.status === 'completed' ? 'success' : 'pending',
        message: result.message,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseError = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      logger.error('Bitnob airtime purchase failed:', {
        error: errorMessage,
        request,
      });
      throw new Error(`Airtime purchase failed: ${responseError || errorMessage}`);
    }
  }

  private mapProviderToChimoney(provider: string): string {
    const mapping: Record<string, string> = {
      safaricom: 'safaricom',
      airtel: 'airtel',
      telkom: 'telkom',
    };
    return mapping[provider] || 'safaricom';
  }

  private mapProviderToKotanipay(provider: string): string {
    const mapping: Record<string, string> = {
      safaricom: 'SAFARICOM',
      airtel: 'AIRTEL',
      telkom: 'TELKOM',
    };
    return mapping[provider] || 'SAFARICOM';
  }

  private mapProviderToBitnob(provider: string): string {
    const mapping: Record<string, string> = {
      safaricom: 'safaricom',
      airtel: 'airtel',
      telkom: 'telkom',
    };
    return mapping[provider] || 'safaricom';
  }

  validateCallback(callback: AirtimeCallback, signature: string): boolean {
    try {
      // Implement proper HMAC signature validation based on provider
      const expectedSignature = crypto
        .createHmac('sha256', config.airtime.chimoneyApiKey)
        .update(JSON.stringify(callback))
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      logger.error('Airtime callback validation failed:', error);
      return false;
    }
  }

  async getTransactionStatus(transactionId: string): Promise<AirtimeResponse> {
    try {
      let response;

      switch (config.airtime.provider) {
        case 'chimoney':
          response = await this.chimoneyApi.get(`/payouts/${transactionId}`);
          break;
        case 'kotanipay':
          response = await this.kotanipayApi.get(`/airtime/status/${transactionId}`);
          break;
        case 'bitnob':
          response = await this.bitnobApi.get(`/airtime/status/${transactionId}`);
          break;
        default:
          throw new Error(`Unsupported airtime provider: ${config.airtime.provider}`);
      }

      const result = response.data;

      return {
        success: result.status === 'success' || result.status === 'completed',
        transactionId: result.id || result.transactionId,
        reference: result.reference,
        amount: result.amount,
        phoneNumber: result.phoneNumber,
        provider: result.provider,
        status: result.status === 'completed' ? 'success' : result.status,
        message: result.message,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get airtime transaction status:', {
        error: errorMessage,
        transactionId,
      });
      throw new Error(`Failed to get transaction status: ${errorMessage}`);
    }
  }
}

export default new AirtimeService();
