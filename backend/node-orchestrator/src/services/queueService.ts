import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';
import mpesaService from './mpesaService';
import airtimeService from './airtimeService';
import walletService from './walletService';

export interface FiatTransaction {
  id: string;
  type: 'mpesa_buy' | 'mpesa_payout' | 'airtime_purchase';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  phoneNumber: string;
  reference: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
  error?: string;
}

export interface MpesaBuyJob {
  transactionId: string;
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  walletId: string;
}

export interface MpesaPayoutJob {
  transactionId: string;
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  lightningInvoice: string;
}

export interface AirtimePurchaseJob {
  transactionId: string;
  phoneNumber: string;
  amount: number;
  provider: string;
  reference: string;
  lightningInvoice: string;
}

class QueueService {
  private redis: IORedis;
  private mpesaBuyQueue: Queue;
  private mpesaPayoutQueue: Queue;
  private airtimeQueue: Queue;
  private mpesaBuyWorker: Worker;
  private mpesaPayoutWorker: Worker;
  private airtimeWorker: Worker;

  constructor() {
    this.redis = new IORedis(config.redis.url, {
      password: config.redis.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.mpesaBuyQueue = new Queue('mpesa-buy', { connection: this.redis });
    this.mpesaPayoutQueue = new Queue('mpesa-payout', { connection: this.redis });
    this.airtimeQueue = new Queue('airtime-purchase', { connection: this.redis });

    this.setupWorkers();
  }

  private setupWorkers() {
    // MPesa Buy Worker
    this.mpesaBuyWorker = new Worker(
      'mpesa-buy',
      async (job: Job<MpesaBuyJob>) => {
        await this.processMpesaBuy(job);
      },
      {
        connection: this.redis,
        concurrency: config.queue.concurrency,
      }
    );

    // MPesa Payout Worker
    this.mpesaPayoutWorker = new Worker(
      'mpesa-payout',
      async (job: Job<MpesaPayoutJob>) => {
        await this.processMpesaPayout(job);
      },
      {
        connection: this.redis,
        concurrency: config.queue.concurrency,
      }
    );

    // Airtime Worker
    this.airtimeWorker = new Worker(
      'airtime-purchase',
      async (job: Job<AirtimePurchaseJob>) => {
        await this.processAirtimePurchase(job);
      },
      {
        connection: this.redis,
        concurrency: config.queue.concurrency,
      }
    );

    this.setupWorkerEventHandlers();
  }

  private setupWorkerEventHandlers() {
    [this.mpesaBuyWorker, this.mpesaPayoutWorker, this.airtimeWorker].forEach((worker) => {
      worker.on('completed', (job) => {
        logger.info(`Job ${job.id} completed successfully`, {
          jobName: job.name,
          jobData: job.data,
        });
      });

      worker.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} failed`, {
          jobName: job?.name,
          jobData: job?.data,
          error: err.message,
        });
      });

      worker.on('error', (err) => {
        logger.error('Worker error:', err);
      });
    });
  }

  private async processMpesaBuy(job: Job<MpesaBuyJob>): Promise<void> {
    const { transactionId, phoneNumber, amount, accountReference, transactionDesc, walletId } =
      job.data;

    try {
      logger.info('Processing MPesa buy job:', { transactionId, phoneNumber, amount });

      // Update transaction status to processing
      await this.updateTransactionStatus(transactionId, 'processing');

      // Initiate STK Push
      const stkResponse = await mpesaService.initiateStkPush({
        phoneNumber,
        amount,
        accountReference,
        transactionDesc,
      });

      // Store STK Push details for webhook processing
      await this.updateTransactionMetadata(transactionId, {
        merchantRequestID: stkResponse.MerchantRequestID,
        checkoutRequestID: stkResponse.CheckoutRequestID,
        responseCode: stkResponse.ResponseCode,
        responseDescription: stkResponse.ResponseDescription,
      });

      logger.info('STK Push initiated successfully:', {
        transactionId,
        merchantRequestID: stkResponse.MerchantRequestID,
        checkoutRequestID: stkResponse.CheckoutRequestID,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MPesa buy job failed:', {
        transactionId,
        error: errorMessage,
      });

      await this.updateTransactionStatus(transactionId, 'failed', errorMessage);
      throw error;
    }
  }

  private async processMpesaPayout(job: Job<MpesaPayoutJob>): Promise<void> {
    const {
      transactionId,
      phoneNumber,
      amount,
      accountReference,
      transactionDesc,
      lightningInvoice,
    } = job.data;

    try {
      logger.info('Processing MPesa payout job:', { transactionId, phoneNumber, amount });

      // Update transaction status to processing
      await this.updateTransactionStatus(transactionId, 'processing');

      // Initiate payout
      const payoutResponse = await mpesaService.initiatePayout({
        phoneNumber,
        amount,
        accountReference,
        transactionDesc,
      });

      // Store payout details
      await this.updateTransactionMetadata(transactionId, {
        originatorConversationID: payoutResponse.OriginatorConversationID,
        conversationID: payoutResponse.ConversationID,
        responseCode: payoutResponse.ResponseCode,
        responseDescription: payoutResponse.ResponseDescription,
        lightningInvoice,
      });

      logger.info('MPesa payout initiated successfully:', {
        transactionId,
        originatorConversationID: payoutResponse.OriginatorConversationID,
        conversationID: payoutResponse.ConversationID,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MPesa payout job failed:', {
        transactionId,
        error: errorMessage,
      });

      await this.updateTransactionStatus(transactionId, 'failed', errorMessage);
      throw error;
    }
  }

  private async processAirtimePurchase(job: Job<AirtimePurchaseJob>): Promise<void> {
    const { transactionId, phoneNumber, amount, provider, reference, lightningInvoice } = job.data;

    try {
      logger.info('Processing airtime purchase job:', {
        transactionId,
        phoneNumber,
        amount,
        provider,
      });

      // Update transaction status to processing
      await this.updateTransactionStatus(transactionId, 'processing');

      // Purchase airtime
      const airtimeResponse = await airtimeService.buyAirtime({
        phoneNumber,
        amount,
        provider: provider as 'safaricom' | 'airtel' | 'telkom',
        reference,
      });

      // Store airtime purchase details
      await this.updateTransactionMetadata(transactionId, {
        airtimeTransactionId: airtimeResponse.transactionId,
        airtimeReference: airtimeResponse.reference,
        airtimeStatus: airtimeResponse.status,
        lightningInvoice,
      });

      // Update final status based on airtime response
      const finalStatus = airtimeResponse.status === 'success' ? 'completed' : 'pending';
      await this.updateTransactionStatus(transactionId, finalStatus);

      logger.info('Airtime purchase completed:', {
        transactionId,
        airtimeTransactionId: airtimeResponse.transactionId,
        status: finalStatus,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Airtime purchase job failed:', {
        transactionId,
        error: errorMessage,
      });

      await this.updateTransactionStatus(transactionId, 'failed', errorMessage);
      throw error;
    }
  }

  async addMpesaBuyJob(data: MpesaBuyJob): Promise<Job<MpesaBuyJob>> {
    const job = await this.mpesaBuyQueue.add('mpesa-buy', data, {
      attempts: config.queue.retryAttempts,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    logger.info('MPesa buy job added to queue:', {
      jobId: job.id,
      transactionId: data.transactionId,
    });

    return job;
  }

  async addMpesaPayoutJob(data: MpesaPayoutJob): Promise<Job<MpesaPayoutJob>> {
    const job = await this.mpesaPayoutQueue.add('mpesa-payout', data, {
      attempts: config.queue.retryAttempts,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    logger.info('MPesa payout job added to queue:', {
      jobId: job.id,
      transactionId: data.transactionId,
    });

    return job;
  }

  async addAirtimeJob(data: AirtimePurchaseJob): Promise<Job<AirtimePurchaseJob>> {
    const job = await this.airtimeQueue.add('airtime-purchase', data, {
      attempts: config.queue.retryAttempts,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    logger.info('Airtime purchase job added to queue:', {
      jobId: job.id,
      transactionId: data.transactionId,
    });

    return job;
  }

  private async updateTransactionStatus(
    transactionId: string,
    status: string,
    error?: string
  ): Promise<void> {
    // In a real implementation, this would update a database
    // For now, we'll just log the status change
    logger.info('Transaction status updated:', {
      transactionId,
      status,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  private async updateTransactionMetadata(transactionId: string, metadata: Record<string, unknown>): Promise<void> {
    // In a real implementation, this would update a database
    logger.info('Transaction metadata updated:', {
      transactionId,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  async getJobStatus(jobId: string): Promise<unknown> {
    // Check all queues for the job
    const queues = [this.mpesaBuyQueue, this.mpesaPayoutQueue, this.airtimeQueue];

    for (const queue of queues) {
      const job = await queue.getJob(jobId);
      if (job) {
        return {
          id: job.id,
          name: job.name,
          data: job.data,
          progress: job.progress,
          state: await job.getState(),
          returnvalue: job.returnvalue,
          failedReason: job.failedReason,
        };
      }
    }

    return null;
  }

  async close(): Promise<void> {
    await Promise.all([
      this.mpesaBuyWorker.close(),
      this.mpesaPayoutWorker.close(),
      this.airtimeWorker.close(),
      this.mpesaBuyQueue.close(),
      this.mpesaPayoutQueue.close(),
      this.airtimeQueue.close(),
      this.redis.disconnect(),
    ]);

    logger.info('Queue service closed');
  }
}

export default new QueueService();
