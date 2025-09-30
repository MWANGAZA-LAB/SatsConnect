import axios, { AxiosInstance } from 'axios';
import config from '../config';
import logger from '../utils/logger';
import { MpesaCallback } from './mpesaService';

export interface BitcoinTransaction {
  txid: string;
  amount: number;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface BitcoinCreditRequest {
  phoneNumber: string;
  amountKes: number;
  mpesaReceiptNumber: string;
  exchangeRate: number;
  walletAddress: string;
  userId: string;
}

export interface BitcoinCreditResponse {
  success: boolean;
  transactionId?: string;
  amountSats: number;
  amountKes: number;
  exchangeRate: number;
  message: string;
  error?: string;
}

export interface ExchangeRateResponse {
  rate: number;
  timestamp: Date;
  source: string;
}

export interface BitcoinBalance {
  totalBalance: number;
  availableBalance: number;
  pendingBalance: number;
  confirmedBalance: number;
}

export interface AirtimePurchaseRequest {
  phoneNumber: string;
  amountSats: number;
  provider: 'Safaricom' | 'Airtel' | 'Telkom';
  walletAddress: string;
  userId: string;
}

export interface AirtimePurchaseResponse {
  success: boolean;
  transactionId?: string;
  amountSats: number;
  amountKes: number;
  provider: string;
  message: string;
  error?: string;
}

export class BitcoinOperationsService {
  private api: AxiosInstance;
  private exchangeRateCache: Map<string, ExchangeRateResponse> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.api = axios.create({
      baseURL: config.bitcoin.rpcUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: config.bitcoin.rpcUser,
        password: config.bitcoin.rpcPassword,
      },
    });
  }

  // Get current Bitcoin exchange rate
  async getExchangeRate(): Promise<ExchangeRateResponse> {
    try {
      const cacheKey = 'KES_BTC';
      const cached = this.exchangeRateCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp.getTime()) < this.CACHE_DURATION) {
        return cached;
      }

      // Try multiple exchange rate sources
      const sources = [
        this.getExchangeRateFromCoinGecko(),
        this.getExchangeRateFromCoinMarketCap(),
        this.getExchangeRateFromBinance(),
      ];

      for (const source of sources) {
        try {
          const rate = await source;
          this.exchangeRateCache.set(cacheKey, rate);
          return rate;
        } catch (error) {
          logger.warn('Exchange rate source failed:', error);
          continue;
        }
      }

      throw new Error('All exchange rate sources failed');
    } catch (error) {
      logger.error('Failed to get exchange rate:', error);
      throw new Error('Unable to fetch Bitcoin exchange rate');
    }
  }

  // Get exchange rate from CoinGecko
  private async getExchangeRateFromCoinGecko(): Promise<ExchangeRateResponse> {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'bitcoin',
        vs_currencies: 'kes',
        include_24hr_change: false,
      },
      timeout: 10000,
    });

    const rate = response.data.bitcoin.kes;
    return {
      rate,
      timestamp: new Date(),
      source: 'CoinGecko',
    };
  }

  // Get exchange rate from CoinMarketCap
  private async getExchangeRateFromCoinMarketCap(): Promise<ExchangeRateResponse> {
    const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
      params: {
        symbol: 'BTC',
        convert: 'KES',
      },
      headers: {
        'X-CMC_PRO_API_KEY': config.exchangeRates.coinMarketCapApiKey,
      },
      timeout: 10000,
    });

    const rate = response.data.data.BTC.quote.KES.price;
    return {
      rate,
      timestamp: new Date(),
      source: 'CoinMarketCap',
    };
  }

  // Get exchange rate from Binance
  private async getExchangeRateFromBinance(): Promise<ExchangeRateResponse> {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: {
        symbol: 'BTCUSDT',
      },
      timeout: 10000,
    });

    const btcUsdRate = parseFloat(response.data.price);
    const usdKesRate = await this.getUsdKesRate();
    const rate = btcUsdRate * usdKesRate;

    return {
      rate,
      timestamp: new Date(),
      source: 'Binance',
    };
  }

  // Get USD to KES rate
  private async getUsdKesRate(): Promise<number> {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
      timeout: 10000,
    });

    return response.data.rates.KES;
  }

  // Convert KES to Satoshis
  async convertKesToSats(amountKes: number): Promise<number> {
    try {
      const exchangeRate = await this.getExchangeRate();
      const amountBtc = amountKes / exchangeRate.rate;
      const amountSats = Math.floor(amountBtc * 100000000); // Convert to satoshis
      
      logger.info('KES to Sats conversion:', {
        amountKes,
        exchangeRate: exchangeRate.rate,
        amountBtc,
        amountSats,
      });

      return amountSats;
    } catch (error) {
      logger.error('Failed to convert KES to Sats:', error);
      throw new Error('Unable to convert KES to Satoshis');
    }
  }

  // Convert Satoshis to KES
  async convertSatsToKes(amountSats: number): Promise<number> {
    try {
      const exchangeRate = await this.getExchangeRate();
      const amountBtc = amountSats / 100000000; // Convert from satoshis
      const amountKes = amountBtc * exchangeRate.rate;
      
      logger.info('Sats to KES conversion:', {
        amountSats,
        exchangeRate: exchangeRate.rate,
        amountBtc,
        amountKes,
      });

      return amountKes;
    } catch (error) {
      logger.error('Failed to convert Sats to KES:', error);
      throw new Error('Unable to convert Satoshis to KES');
    }
  }

  // Credit Bitcoin to user wallet
  async creditBitcoin(request: BitcoinCreditRequest): Promise<BitcoinCreditResponse> {
    try {
      logger.info('Processing Bitcoin credit request:', {
        phoneNumber: request.phoneNumber,
        amountKes: request.amountKes,
        mpesaReceiptNumber: request.mpesaReceiptNumber,
        walletAddress: request.walletAddress,
        userId: request.userId,
      });

      // Convert KES to Satoshis
      const amountSats = await this.convertKesToSats(request.amountKes);
      
      // Validate minimum amount
      if (amountSats < 1000) { // Minimum 1000 sats
        return {
          success: false,
          amountSats: 0,
          amountKes: request.amountKes,
          exchangeRate: request.exchangeRate,
          message: 'Amount too small. Minimum 1000 satoshis required.',
          error: 'INSUFFICIENT_AMOUNT',
        };
      }

      // Create Bitcoin transaction
      const transactionId = await this.createBitcoinTransaction({
        to: request.walletAddress,
        amount: amountSats,
        memo: `MPesa credit for ${request.phoneNumber}`,
        reference: request.mpesaReceiptNumber,
      });

      // Record transaction in database
      await this.recordTransaction({
        txid: transactionId,
        amount: amountSats,
        confirmations: 0,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      logger.info('Bitcoin credit successful:', {
        transactionId,
        amountSats,
        amountKes: request.amountKes,
        exchangeRate: request.exchangeRate,
      });

      return {
        success: true,
        transactionId,
        amountSats,
        amountKes: request.amountKes,
        exchangeRate: request.exchangeRate,
        message: `Successfully credited ${amountSats} satoshis to your wallet`,
      };
    } catch (error) {
      logger.error('Bitcoin credit failed:', error);
      return {
        success: false,
        amountSats: 0,
        amountKes: request.amountKes,
        exchangeRate: request.exchangeRate,
        message: 'Failed to credit Bitcoin to wallet',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Create Bitcoin transaction
  private async createBitcoinTransaction(params: {
    to: string;
    amount: number;
    memo: string;
    reference: string;
  }): Promise<string> {
    try {
      // Call Rust Lightning Engine to create transaction
      const response = await axios.post('http://localhost:50051/bitcoin/send', {
        to: params.to,
        amount: params.amount,
        memo: params.memo,
        reference: params.reference,
      });

      return response.data.transactionId;
    } catch (error) {
      logger.error('Failed to create Bitcoin transaction:', error);
      throw new Error('Unable to create Bitcoin transaction');
    }
  }

  // Record transaction in database
  private async recordTransaction(transaction: BitcoinTransaction): Promise<void> {
    try {
      // In production, save to database
      logger.info('Recording Bitcoin transaction:', transaction);
      
      // TODO: Implement database storage
      // await this.database.bitcoinTransactions.create(transaction);
    } catch (error) {
      logger.error('Failed to record transaction:', error);
      throw error;
    }
  }

  // Process MPesa callback and credit Bitcoin
  async processMpesaCallback(callback: MpesaCallback): Promise<BitcoinCreditResponse> {
    try {
      const details = this.extractTransactionDetails(callback);
      
      if (details.resultCode !== 0) {
        return {
          success: false,
          amountSats: 0,
          amountKes: 0,
          exchangeRate: 0,
          message: `MPesa transaction failed: ${details.resultDesc}`,
          error: 'MPESA_TRANSACTION_FAILED',
        };
      }

      // Get user wallet address
      const walletAddress = await this.getUserWalletAddress(details.phoneNumber);
      if (!walletAddress) {
        return {
          success: false,
          amountSats: 0,
          amountKes: 0,
          exchangeRate: 0,
          message: 'User wallet not found',
          error: 'WALLET_NOT_FOUND',
        };
      }

      // Credit Bitcoin
      const creditRequest: BitcoinCreditRequest = {
        phoneNumber: details.phoneNumber,
        amountKes: details.amount || 0,
        mpesaReceiptNumber: details.mpesaReceiptNumber || '',
        exchangeRate: await this.getExchangeRate().then(r => r.rate),
        walletAddress,
        userId: details.phoneNumber, // Use phone number as user ID
      };

      return await this.creditBitcoin(creditRequest);
    } catch (error) {
      logger.error('Failed to process MPesa callback:', error);
      return {
        success: false,
        amountSats: 0,
        amountKes: 0,
        exchangeRate: 0,
        message: 'Failed to process MPesa callback',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Extract transaction details from MPesa callback
  private extractTransactionDetails(callback: MpesaCallback): {
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

    const details: Record<string, unknown> = {
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

    return details as any;
  }

  // Get user wallet address
  private async getUserWalletAddress(phoneNumber: string): Promise<string | null> {
    try {
      // In production, query database for user wallet
      // For now, return a placeholder
      return `tb1q${phoneNumber.slice(-8)}${'0'.repeat(26)}`;
    } catch (error) {
      logger.error('Failed to get user wallet address:', error);
      return null;
    }
  }

  // Purchase airtime with Bitcoin
  async purchaseAirtime(request: AirtimePurchaseRequest): Promise<AirtimePurchaseResponse> {
    try {
      logger.info('Processing airtime purchase request:', {
        phoneNumber: request.phoneNumber,
        amountSats: request.amountSats,
        provider: request.provider,
        walletAddress: request.walletAddress,
        userId: request.userId,
      });

      // Convert Satoshis to KES
      const amountKes = await this.convertSatsToKes(request.amountSats);
      
      // Validate minimum amount
      if (amountKes < 10) { // Minimum 10 KES
        return {
          success: false,
          amountSats: request.amountSats,
          amountKes: 0,
          provider: request.provider,
          message: 'Amount too small. Minimum 10 KES required.',
          error: 'INSUFFICIENT_AMOUNT',
        };
      }

      // Create airtime purchase transaction
      const transactionId = await this.createAirtimeTransaction({
        phoneNumber: request.phoneNumber,
        amountKes,
        provider: request.provider,
        reference: `airtime_${Date.now()}`,
      });

      // Record transaction
      await this.recordAirtimeTransaction({
        transactionId,
        phoneNumber: request.phoneNumber,
        amountSats: request.amountSats,
        amountKes,
        provider: request.provider,
        status: 'pending',
        createdAt: new Date(),
      });

      logger.info('Airtime purchase successful:', {
        transactionId,
        amountSats: request.amountSats,
        amountKes,
        provider: request.provider,
      });

      return {
        success: true,
        transactionId,
        amountSats: request.amountSats,
        amountKes,
        provider: request.provider,
        message: `Successfully purchased ${amountKes} KES airtime for ${request.phoneNumber}`,
      };
    } catch (error) {
      logger.error('Airtime purchase failed:', error);
      return {
        success: false,
        amountSats: request.amountSats,
        amountKes: 0,
        provider: request.provider,
        message: 'Failed to purchase airtime',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Create airtime purchase transaction
  private async createAirtimeTransaction(params: {
    phoneNumber: string;
    amountKes: number;
    provider: string;
    reference: string;
  }): Promise<string> {
    try {
      // Call MPesa service to purchase airtime
      const response = await axios.post('http://localhost:3000/api/mpesa/purchase-airtime', {
        phoneNumber: params.phoneNumber,
        amount: params.amountKes,
        provider: params.provider,
        reference: params.reference,
      });

      return response.data.transactionId;
    } catch (error) {
      logger.error('Failed to create airtime transaction:', error);
      throw new Error('Unable to create airtime transaction');
    }
  }

  // Record airtime transaction
  private async recordAirtimeTransaction(transaction: {
    transactionId: string;
    phoneNumber: string;
    amountSats: number;
    amountKes: number;
    provider: string;
    status: string;
    createdAt: Date;
  }): Promise<void> {
    try {
      // In production, save to database
      logger.info('Recording airtime transaction:', transaction);
      
      // TODO: Implement database storage
      // await this.database.airtimeTransactions.create(transaction);
    } catch (error) {
      logger.error('Failed to record airtime transaction:', error);
      throw error;
    }
  }

  // Get Bitcoin balance
  async getBitcoinBalance(walletAddress: string): Promise<BitcoinBalance> {
    try {
      // Call Rust Lightning Engine to get balance
      const response = await axios.get(`http://localhost:50051/bitcoin/balance/${walletAddress}`);
      
      return {
        totalBalance: response.data.totalBalance,
        availableBalance: response.data.availableBalance,
        pendingBalance: response.data.pendingBalance,
        confirmedBalance: response.data.confirmedBalance,
      };
    } catch (error) {
      logger.error('Failed to get Bitcoin balance:', error);
      throw new Error('Unable to fetch Bitcoin balance');
    }
  }

  // Get transaction history
  async getTransactionHistory(walletAddress: string, limit: number = 50): Promise<BitcoinTransaction[]> {
    try {
      // Call Rust Lightning Engine to get transaction history
      const response = await axios.get(`http://localhost:50051/bitcoin/transactions/${walletAddress}?limit=${limit}`);
      
      return response.data.transactions;
    } catch (error) {
      logger.error('Failed to get transaction history:', error);
      throw new Error('Unable to fetch transaction history');
    }
  }
}

export default new BitcoinOperationsService();
