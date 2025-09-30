import { mpesaService } from './mpesaService';
import { bitcoinOperationsService } from './bitcoinOperationsService';
import { walletService } from './walletService';
import { logger } from '../utils/logger';
import { queueService } from './queueService';

export interface WebhookProcessorResult {
  success: boolean;
  transactionId?: string;
  amountSats?: number;
  amountKes?: number;
  message: string;
  error?: string;
}

export class WebhookProcessor {
  /**
   * Process MPesa STK Push callback
   */
  async processMpesaCallback(callback: any, signature: string): Promise<WebhookProcessorResult> {
    try {
      logger.info('Processing MPesa callback:', {
        merchantRequestID: callback.Body?.stkCallback?.MerchantRequestID,
        checkoutRequestID: callback.Body?.stkCallback?.CheckoutRequestID,
        resultCode: callback.Body?.stkCallback?.ResultCode,
      });

      // Validate callback signature
      if (!mpesaService.validateCallback(callback, signature)) {
        logger.warn('Invalid MPesa callback signature');
        return {
          success: false,
          message: 'Invalid callback signature',
          error: 'INVALID_SIGNATURE',
        };
      }

      // Process callback and extract transaction details
      const transactionDetails = mpesaService.processCallback(callback);

      if (!transactionDetails.success) {
        logger.warn('MPesa transaction failed:', {
          resultCode: transactionDetails.resultCode,
          resultDesc: transactionDetails.resultDesc,
        });

        // Update transaction status to failed
        await this.updateTransactionStatus(
          transactionDetails.checkoutRequestID,
          'failed',
          transactionDetails.resultDesc
        );

        return {
          success: false,
          message: `Transaction failed: ${transactionDetails.resultDesc}`,
          error: 'MPESA_TRANSACTION_FAILED',
        };
      }

      // Transaction successful - process Bitcoin credit
      logger.info('MPesa transaction successful, processing Bitcoin credit:', {
        amount: transactionDetails.amount,
        phoneNumber: transactionDetails.phoneNumber,
        mpesaReceiptNumber: transactionDetails.mpesaReceiptNumber,
      });

      // Get user's wallet address
      const walletAddress = await this.getUserWalletAddress(transactionDetails.phoneNumber);
      if (!walletAddress) {
        logger.error('User wallet not found for phone number:', transactionDetails.phoneNumber);
        return {
          success: false,
          message: 'User wallet not found',
          error: 'WALLET_NOT_FOUND',
        };
      }

      // Credit Bitcoin to user's wallet
      const creditResult = await bitcoinOperationsService.creditBitcoin({
        phoneNumber: transactionDetails.phoneNumber,
        amountKes: transactionDetails.amount || 0,
        mpesaReceiptNumber: transactionDetails.mpesaReceiptNumber || '',
        exchangeRate: await this.getCurrentExchangeRate(),
        walletAddress,
        userId: transactionDetails.phoneNumber,
      });

      if (creditResult.success) {
        // Update transaction status to completed
        await this.updateTransactionStatus(
          transactionDetails.checkoutRequestID,
          'completed',
          'Bitcoin credited successfully'
        );

        // Send notification to user (if notification service is available)
        await this.sendNotification(transactionDetails.phoneNumber, {
          type: 'bitcoin_credited',
          amountSats: creditResult.amountSats,
          amountKes: creditResult.amountKes,
          message: creditResult.message,
        });

        logger.info('Bitcoin credit completed successfully:', {
          transactionId: creditResult.transactionId,
          amountSats: creditResult.amountSats,
          amountKes: creditResult.amountKes,
        });

        return {
          success: true,
          transactionId: creditResult.transactionId,
          amountSats: creditResult.amountSats,
          amountKes: creditResult.amountKes,
          message: creditResult.message,
        };
      } else {
        logger.error('Bitcoin credit failed:', creditResult.error);

        // Update transaction status to failed
        await this.updateTransactionStatus(
          transactionDetails.checkoutRequestID,
          'failed',
          creditResult.error || 'Bitcoin credit failed'
        );

        return {
          success: false,
          message: creditResult.error || 'Failed to credit Bitcoin',
          error: 'BITCOIN_CREDIT_FAILED',
        };
      }
    } catch (error) {
      logger.error('Webhook processing failed:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process airtime purchase callback
   */
  async processAirtimeCallback(callback: any, signature: string): Promise<WebhookProcessorResult> {
    try {
      logger.info('Processing airtime callback:', {
        transactionId: callback.transactionId,
        status: callback.status,
        amount: callback.amount,
        phoneNumber: callback.phoneNumber,
        provider: callback.provider,
      });

      // Validate callback signature
      if (!this.validateAirtimeCallback(callback, signature)) {
        logger.warn('Invalid airtime callback signature');
        return {
          success: false,
          message: 'Invalid callback signature',
          error: 'INVALID_SIGNATURE',
        };
      }

      if (callback.status === 'success') {
        // Airtime purchase successful - process Lightning payment
        logger.info('Airtime purchase successful, processing Lightning payment');

        // TODO: Process Lightning payment
        // This would involve:
        // 1. Verifying the airtime was actually delivered
        // 2. Processing the Lightning payment
        // 3. Updating transaction status

        await this.updateTransactionStatus(
          callback.transactionId,
          'completed',
          'Airtime purchased successfully'
        );

        return {
          success: true,
          message: 'Airtime purchased successfully',
        };
      } else {
        // Airtime purchase failed
        logger.warn('Airtime purchase failed:', {
          transactionId: callback.transactionId,
          status: callback.status,
          message: callback.message,
        });

        await this.updateTransactionStatus(
          callback.transactionId,
          'failed',
          callback.message || 'Airtime purchase failed'
        );

        return {
          success: false,
          message: callback.message || 'Airtime purchase failed',
          error: 'AIRTIME_PURCHASE_FAILED',
        };
      }
    } catch (error) {
      logger.error('Airtime callback processing failed:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process MPesa payout callback
   */
  async processMpesaPayoutCallback(callback: any, signature: string): Promise<WebhookProcessorResult> {
    try {
      logger.info('Processing MPesa payout callback:', {
        originatorConversationID: callback.OriginatorConversationID,
        conversationID: callback.ConversationID,
        resultCode: callback.ResultCode,
        resultDesc: callback.ResultDesc,
      });

      // Validate callback signature
      if (!mpesaService.validateCallback(callback, signature)) {
        logger.warn('Invalid MPesa payout callback signature');
        return {
          success: false,
          message: 'Invalid callback signature',
          error: 'INVALID_SIGNATURE',
        };
      }

      if (callback.ResultCode === 0) {
        // Payout successful
        logger.info('MPesa payout successful');

        // TODO: Process successful payout
        // This would involve:
        // 1. Verifying the payout with MPesa
        // 2. Processing the Lightning payment
        // 3. Updating transaction status

        return {
          success: true,
          message: 'Payout completed successfully',
        };
      } else {
        // Payout failed
        logger.warn('MPesa payout failed:', {
          resultCode: callback.ResultCode,
          resultDesc: callback.ResultDesc,
        });

        return {
          success: false,
          message: callback.ResultDesc || 'Payout failed',
          error: 'MPESA_PAYOUT_FAILED',
        };
      }
    } catch (error) {
      logger.error('MPesa payout callback processing failed:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get user's wallet address by phone number
   */
  private async getUserWalletAddress(phoneNumber: string): Promise<string | null> {
    try {
      // In a real implementation, you would query your database
      // to find the user's wallet address by phone number
      // For now, we'll use a mock implementation
      
      // TODO: Implement actual database query
      // const user = await userService.findByPhoneNumber(phoneNumber);
      // return user?.walletAddress || null;
      
      // Mock implementation - return a test address
      return 'tb1qtest123456789abcdefghijklmnopqrstuvwxyz';
    } catch (error) {
      logger.error('Failed to get user wallet address:', error);
      return null;
    }
  }

  /**
   * Get current exchange rate
   */
  private async getCurrentExchangeRate(): Promise<number> {
    try {
      const rateData = await bitcoinOperationsService.getExchangeRate();
      return rateData.rate;
    } catch (error) {
      logger.error('Failed to get exchange rate:', error);
      // Return a fallback rate
      return 4000000; // 1 BTC = 4,000,000 KES
    }
  }

  /**
   * Update transaction status in database
   */
  private async updateTransactionStatus(
    transactionId: string,
    status: 'pending' | 'completed' | 'failed',
    message?: string
  ): Promise<void> {
    try {
      // TODO: Implement actual database update
      // await transactionService.updateStatus(transactionId, status, message);
      
      logger.info('Transaction status updated:', {
        transactionId,
        status,
        message,
      });
    } catch (error) {
      logger.error('Failed to update transaction status:', error);
    }
  }

  /**
   * Send notification to user
   */
  private async sendNotification(phoneNumber: string, data: any): Promise<void> {
    try {
      // TODO: Implement actual notification service
      // await notificationService.send(phoneNumber, data);
      
      logger.info('Notification sent to user:', {
        phoneNumber,
        type: data.type,
      });
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  /**
   * Validate airtime callback signature
   */
  private validateAirtimeCallback(callback: any, signature: string): boolean {
    try {
      // In a real implementation, you would validate the signature
      // using your airtime provider's secret key
      return true;
    } catch (error) {
      logger.error('Airtime callback validation failed:', error);
      return false;
    }
  }

  /**
   * Health check for webhook processor
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if all required services are available
      const mpesaHealth = await mpesaService.healthCheck();
      // Add other health checks as needed
      
      return mpesaHealth;
    } catch (error) {
      logger.error('Webhook processor health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const webhookProcessor = new WebhookProcessor();
