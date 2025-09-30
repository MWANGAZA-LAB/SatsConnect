import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { sanitizeError, createStrictRateLimit } from '../middleware/security';
import mpesaService from '../services/mpesaService';
import airtimeService from '../services/airtimeService';
import queueService from '../services/queueService';
import walletService from '../services/walletService';
import logger from '../utils/logger';

const router = express.Router();

// Validation middleware
const validateRequest = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// Generate unique transaction ID
const generateTransactionId = (): string => {
  return `fiat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// MPesa Buy Bitcoin (KES → BTC)
router.post(
  '/mpesa/buy',
  [
    createStrictRateLimit(),
    authenticateToken,
    body('phoneNumber').isMobilePhone('en-KE').withMessage('Valid Kenyan phone number required'),
    body('amount')
      .isFloat({ min: 1, max: 150000 })
      .withMessage('Amount must be between 1 and 150,000 KES'),
    body('walletId').isString().notEmpty().withMessage('Wallet ID is required'),
    body('accountReference')
      .optional()
      .isString()
      .isLength({ min: 1, max: 20 })
      .withMessage('Account reference must be 1-20 characters'),
    body('transactionDesc')
      .optional()
      .isString()
      .isLength({ min: 1, max: 20 })
      .withMessage('Transaction description must be 1-20 characters'),
    validateRequest,
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const { phoneNumber, amount, walletId, accountReference, transactionDesc } = req.body;
      const transactionId = generateTransactionId();

      logger.info('MPesa buy request received:', {
        transactionId,
        phoneNumber,
        amount,
        walletId,
      });

      // Add job to queue for async processing
      await queueService.addMpesaBuyJob({
        transactionId,
        phoneNumber,
        amount,
        accountReference: accountReference || `SATS_${transactionId}`,
        transactionDesc: transactionDesc || 'Bitcoin Purchase',
        walletId,
      });

      res.status(202).json({
        success: true,
        data: {
          transactionId,
          status: 'pending',
          message: 'STK Push initiated. Please check your phone to complete the transaction.',
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MPesa buy request failed:', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to initiate MPesa buy transaction',
      });
    }
  }
);

// MPesa Payout (BTC → KES)
router.post(
  '/mpesa/payout',
  [
    createStrictRateLimit(),
    authenticateToken,
    body('phoneNumber').isMobilePhone('en-KE').withMessage('Valid Kenyan phone number required'),
    body('amount')
      .isFloat({ min: 1, max: 150000 })
      .withMessage('Amount must be between 1 and 150,000 KES'),
    body('lightningInvoice').isString().notEmpty().withMessage('Lightning invoice is required'),
    body('accountReference')
      .optional()
      .isString()
      .isLength({ min: 1, max: 20 })
      .withMessage('Account reference must be 1-20 characters'),
    body('transactionDesc')
      .optional()
      .isString()
      .isLength({ min: 1, max: 20 })
      .withMessage('Transaction description must be 1-20 characters'),
    validateRequest,
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const { phoneNumber, amount, lightningInvoice, accountReference, transactionDesc } = req.body;
      const transactionId = generateTransactionId();

      logger.info('MPesa payout request received:', {
        transactionId,
        phoneNumber,
        amount,
        lightningInvoice: lightningInvoice.substring(0, 20) + '...',
      });

      // Add job to queue for async processing
      await queueService.addMpesaPayoutJob({
        transactionId,
        phoneNumber,
        amount,
        accountReference: accountReference || `SATS_${transactionId}`,
        transactionDesc: transactionDesc || 'Bitcoin Payout',
        lightningInvoice,
      });

      res.status(202).json({
        success: true,
        data: {
          transactionId,
          status: 'pending',
          message: 'Payout initiated. Processing will begin shortly.',
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MPesa payout request failed:', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to initiate MPesa payout transaction',
      });
    }
  }
);

// Buy Airtime with Bitcoin
router.post(
  '/airtime',
  [
    createStrictRateLimit(),
    authenticateToken,
    body('phoneNumber').isMobilePhone('en-KE').withMessage('Valid Kenyan phone number required'),
    body('amount')
      .isFloat({ min: 10, max: 10000 })
      .withMessage('Amount must be between 10 and 10,000 KES'),
    body('provider')
      .isIn(['safaricom', 'airtel', 'telkom'])
      .withMessage('Provider must be safaricom, airtel, or telkom'),
    body('lightningInvoice').isString().notEmpty().withMessage('Lightning invoice is required'),
    body('reference')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Reference must be 1-50 characters'),
    validateRequest,
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const { phoneNumber, amount, provider, lightningInvoice, reference } = req.body;
      const transactionId = generateTransactionId();

      logger.info('Airtime purchase request received:', {
        transactionId,
        phoneNumber,
        amount,
        provider,
        lightningInvoice: lightningInvoice.substring(0, 20) + '...',
      });

      // Add job to queue for async processing
      await queueService.addAirtimeJob({
        transactionId,
        phoneNumber,
        amount,
        provider,
        reference: reference || `airtime_${transactionId}`,
        lightningInvoice,
      });

      res.status(202).json({
        success: true,
        data: {
          transactionId,
          status: 'pending',
          message: 'Airtime purchase initiated. Processing will begin shortly.',
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Airtime purchase request failed:', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to initiate airtime purchase',
      });
    }
  }
);

// Get transaction status
router.get(
  '/transaction/:transactionId',
  [
    authenticateToken,
    param('transactionId').isString().notEmpty().withMessage('Transaction ID is required'),
    validateRequest,
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const { transactionId } = req.params;

      // Get job status from queue
      const jobStatus = await queueService.getJobStatus(transactionId);

      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
      }

      res.json({
        success: true,
        data: {
          transactionId,
          status: (jobStatus as { state: string; progress: number; data: unknown; failedReason: string; returnvalue: unknown }).state,
          progress: (jobStatus as { state: string; progress: number; data: unknown; failedReason: string; returnvalue: unknown }).progress,
          data: (jobStatus as { state: string; progress: number; data: unknown; failedReason: string; returnvalue: unknown }).data,
          failedReason: (jobStatus as { state: string; progress: number; data: unknown; failedReason: string; returnvalue: unknown }).failedReason,
          returnValue: (jobStatus as { state: string; progress: number; data: unknown; failedReason: string; returnvalue: unknown }).returnvalue,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Get transaction status failed:', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction status',
      });
    }
  }
);

// Get supported airtime providers
router.get(
  '/airtime/providers',
  authenticateToken,
  (req: express.Request, res: express.Response) => {
    res.json({
      success: true,
      data: {
        providers: [
          {
            id: 'safaricom',
            name: 'Safaricom',
            minAmount: 10,
            maxAmount: 10000,
            currency: 'KES',
          },
          {
            id: 'airtel',
            name: 'Airtel',
            minAmount: 10,
            maxAmount: 10000,
            currency: 'KES',
          },
          {
            id: 'telkom',
            name: 'Telkom',
            minAmount: 10,
            maxAmount: 10000,
            currency: 'KES',
          },
        ],
      },
    });
  }
);

// Get MPesa transaction limits
router.get('/mpesa/limits', authenticateToken, (req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    data: {
      buy: {
        minAmount: 1,
        maxAmount: 150000,
        currency: 'KES',
        description: 'MPesa STK Push limits for buying Bitcoin',
      },
      payout: {
        minAmount: 1,
        maxAmount: 150000,
        currency: 'KES',
        description: 'MPesa payout limits for selling Bitcoin',
      },
    },
  });
});

// Error handling middleware
router.use(sanitizeError);

export default router;
