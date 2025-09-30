import { logger } from '../utils/logger';
import { bitcoinOperationsService } from './bitcoinOperationsService';
import { mpesaService } from './mpesaService';

export interface ReconciliationTransaction {
  id: string;
  type: 'buy' | 'sell' | 'airtime' | 'bill';
  status: 'pending' | 'completed' | 'failed' | 'disputed';
  amountKes: number;
  amountSats?: number;
  exchangeRate: number;
  phoneNumber: string;
  mpesaReceiptNumber?: string;
  lightningInvoice?: string;
  paymentHash?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: any;
}

export interface ReconciliationResult {
  success: boolean;
  matched: number;
  unmatched: number;
  errors: number;
  details: {
    matched: ReconciliationTransaction[];
    unmatched: ReconciliationTransaction[];
    errors: Array<{
      transaction: ReconciliationTransaction;
      error: string;
    }>;
  };
}

export interface SettlementReport {
  date: string;
  totalTransactions: number;
  totalAmountKes: number;
  totalAmountSats: number;
  averageExchangeRate: number;
  successRate: number;
  reconciliation: ReconciliationResult;
}

export class ReconciliationService {
  private transactions: Map<string, ReconciliationTransaction> = new Map();

  /**
   * Add a transaction to reconciliation queue
   */
  async addTransaction(transaction: Omit<ReconciliationTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = this.generateTransactionId();
    const now = new Date();
    
    const reconciliationTransaction: ReconciliationTransaction = {
      ...transaction,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.transactions.set(id, reconciliationTransaction);
    
    logger.info('Transaction added to reconciliation queue:', {
      id,
      type: transaction.type,
      amountKes: transaction.amountKes,
      phoneNumber: transaction.phoneNumber,
    });

    return id;
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    id: string,
    status: ReconciliationTransaction['status'],
    metadata?: any
  ): Promise<boolean> {
    const transaction = this.transactions.get(id);
    if (!transaction) {
      logger.warn('Transaction not found for status update:', { id });
      return false;
    }

    transaction.status = status;
    transaction.updatedAt = new Date();
    if (metadata) {
      transaction.metadata = { ...transaction.metadata, ...metadata };
    }

    this.transactions.set(id, transaction);
    
    logger.info('Transaction status updated:', {
      id,
      status,
      type: transaction.type,
    });

    return true;
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(id: string): Promise<ReconciliationTransaction | null> {
    return this.transactions.get(id) || null;
  }

  /**
   * Get transactions by status
   */
  async getTransactionsByStatus(status: ReconciliationTransaction['status']): Promise<ReconciliationTransaction[]> {
    return Array.from(this.transactions.values()).filter(t => t.status === status);
  }

  /**
   * Get transactions by phone number
   */
  async getTransactionsByPhoneNumber(phoneNumber: string): Promise<ReconciliationTransaction[]> {
    return Array.from(this.transactions.values()).filter(t => t.phoneNumber === phoneNumber);
  }

  /**
   * Run reconciliation for a specific date range
   */
  async runReconciliation(
    startDate: Date,
    endDate: Date
  ): Promise<ReconciliationResult> {
    logger.info('Starting reconciliation process:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const transactions = Array.from(this.transactions.values()).filter(
      t => t.createdAt >= startDate && t.createdAt <= endDate
    );

    const result: ReconciliationResult = {
      success: true,
      matched: 0,
      unmatched: 0,
      errors: 0,
      details: {
        matched: [],
        unmatched: [],
        errors: [],
      },
    };

    for (const transaction of transactions) {
      try {
        const reconciliationResult = await this.reconcileTransaction(transaction);
        
        if (reconciliationResult.success) {
          result.matched++;
          result.details.matched.push(transaction);
          
          // Update transaction status
          await this.updateTransactionStatus(transaction.id, 'completed', {
            reconciledAt: new Date(),
            reconciliationResult,
          });
        } else {
          result.unmatched++;
          result.details.unmatched.push(transaction);
          
          // Update transaction status
          await this.updateTransactionStatus(transaction.id, 'disputed', {
            reconciliationError: reconciliationResult.error,
            reconciledAt: new Date(),
          });
        }
      } catch (error) {
        result.errors++;
        result.details.errors.push({
          transaction,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        logger.error('Reconciliation error for transaction:', {
          transactionId: transaction.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Reconciliation completed:', {
      total: transactions.length,
      matched: result.matched,
      unmatched: result.unmatched,
      errors: result.errors,
    });

    return result;
  }

  /**
   * Reconcile a single transaction
   */
  private async reconcileTransaction(transaction: ReconciliationTransaction): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      switch (transaction.type) {
        case 'buy':
          return await this.reconcileBuyTransaction(transaction);
        case 'sell':
          return await this.reconcileSellTransaction(transaction);
        case 'airtime':
          return await this.reconcileAirtimeTransaction(transaction);
        case 'bill':
          return await this.reconcileBillTransaction(transaction);
        default:
          return {
            success: false,
            error: 'Unknown transaction type',
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reconcile buy transaction (MPesa → Bitcoin)
   */
  private async reconcileBuyTransaction(transaction: ReconciliationTransaction): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Verify MPesa transaction
      if (!transaction.mpesaReceiptNumber) {
        return {
          success: false,
          error: 'Missing MPesa receipt number',
        };
      }

      // In a real implementation, you would:
      // 1. Verify the MPesa transaction with Safaricom
      // 2. Check if the amount matches
      // 3. Verify the phone number
      // 4. Check if Bitcoin was actually credited

      // For now, we'll do basic validation
      if (transaction.amountKes <= 0) {
        return {
          success: false,
          error: 'Invalid amount',
        };
      }

      if (!transaction.phoneNumber || !transaction.phoneNumber.startsWith('254')) {
        return {
          success: false,
          error: 'Invalid phone number',
        };
      }

      // Check if Bitcoin was credited
      if (!transaction.amountSats || transaction.amountSats <= 0) {
        return {
          success: false,
          error: 'Bitcoin not credited',
        };
      }

      // Verify exchange rate is reasonable
      const expectedSats = Math.round((transaction.amountKes / transaction.exchangeRate) * 100000000);
      const tolerance = 0.01; // 1% tolerance
      const difference = Math.abs(transaction.amountSats - expectedSats) / expectedSats;
      
      if (difference > tolerance) {
        return {
          success: false,
          error: `Exchange rate mismatch: expected ${expectedSats} sats, got ${transaction.amountSats} sats`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reconcile sell transaction (Bitcoin → MPesa)
   */
  private async reconcileSellTransaction(transaction: ReconciliationTransaction): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Verify Lightning payment
      if (!transaction.lightningInvoice || !transaction.paymentHash) {
        return {
          success: false,
          error: 'Missing Lightning payment details',
        };
      }

      // In a real implementation, you would:
      // 1. Verify the Lightning payment was sent
      // 2. Check if MPesa payout was successful
      // 3. Verify amounts match

      // For now, we'll do basic validation
      if (transaction.amountKes <= 0) {
        return {
          success: false,
          error: 'Invalid amount',
        };
      }

      if (!transaction.phoneNumber || !transaction.phoneNumber.startsWith('254')) {
        return {
          success: false,
          error: 'Invalid phone number',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reconcile airtime transaction
   */
  private async reconcileAirtimeTransaction(transaction: ReconciliationTransaction): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Verify Lightning payment
      if (!transaction.lightningInvoice || !transaction.paymentHash) {
        return {
          success: false,
          error: 'Missing Lightning payment details',
        };
      }

      // In a real implementation, you would:
      // 1. Verify the Lightning payment was sent
      // 2. Check if airtime was actually delivered
      // 3. Verify amounts match

      if (transaction.amountKes <= 0) {
        return {
          success: false,
          error: 'Invalid amount',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reconcile bill payment transaction
   */
  private async reconcileBillTransaction(transaction: ReconciliationTransaction): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Similar to airtime transaction
      if (!transaction.lightningInvoice || !transaction.paymentHash) {
        return {
          success: false,
          error: 'Missing Lightning payment details',
        };
      }

      if (transaction.amountKes <= 0) {
        return {
          success: false,
          error: 'Invalid amount',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate settlement report
   */
  async generateSettlementReport(
    startDate: Date,
    endDate: Date
  ): Promise<SettlementReport> {
    const transactions = Array.from(this.transactions.values()).filter(
      t => t.createdAt >= startDate && t.createdAt <= endDate
    );

    const reconciliation = await this.runReconciliation(startDate, endDate);

    const totalAmountKes = transactions.reduce((sum, t) => sum + t.amountKes, 0);
    const totalAmountSats = transactions.reduce((sum, t) => sum + (t.amountSats || 0), 0);
    const averageExchangeRate = totalAmountSats > 0 ? totalAmountKes / (totalAmountSats / 100000000) : 0;
    const successRate = transactions.length > 0 ? (reconciliation.matched / transactions.length) * 100 : 0;

    return {
      date: endDate.toISOString().split('T')[0],
      totalTransactions: transactions.length,
      totalAmountKes,
      totalAmountSats,
      averageExchangeRate,
      successRate,
      reconciliation,
    };
  }

  /**
   * Get daily settlement summary
   */
  async getDailySettlement(date: Date): Promise<{
    date: string;
    buyTransactions: number;
    sellTransactions: number;
    airtimeTransactions: number;
    billTransactions: number;
    totalAmountKes: number;
    totalAmountSats: number;
    successRate: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const transactions = Array.from(this.transactions.values()).filter(
      t => t.createdAt >= startOfDay && t.createdAt <= endOfDay
    );

    const buyTransactions = transactions.filter(t => t.type === 'buy').length;
    const sellTransactions = transactions.filter(t => t.type === 'sell').length;
    const airtimeTransactions = transactions.filter(t => t.type === 'airtime').length;
    const billTransactions = transactions.filter(t => t.type === 'bill').length;

    const totalAmountKes = transactions.reduce((sum, t) => sum + t.amountKes, 0);
    const totalAmountSats = transactions.reduce((sum, t) => sum + (t.amountSats || 0), 0);

    const completedTransactions = transactions.filter(t => t.status === 'completed').length;
    const successRate = transactions.length > 0 ? (completedTransactions / transactions.length) * 100 : 0;

    return {
      date: date.toISOString().split('T')[0],
      buyTransactions,
      sellTransactions,
      airtimeTransactions,
      billTransactions,
      totalAmountKes,
      totalAmountSats,
      successRate,
    };
  }

  /**
   * Generate transaction ID
   */
  private generateTransactionId(): string {
    return `recon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check for reconciliation service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can access the transaction store
      const transactionCount = this.transactions.size;
      
      // In a real implementation, you would also check:
      // - Database connectivity
      // - External service availability
      // - Queue system health
      
      logger.info('Reconciliation service health check:', {
        transactionCount,
        status: 'healthy',
      });

      return true;
    } catch (error) {
      logger.error('Reconciliation service health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const reconciliationService = new ReconciliationService();
