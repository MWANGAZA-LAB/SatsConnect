import express from 'express';
import { body, validationResult } from 'express-validator';
import { mpesaService } from '../services/mpesaService';
import { webhookProcessor } from '../services/webhookProcessor';
import airtimeService from '../services/airtimeService';
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

// MPesa STK Push Callback
router.post(
  '/mpesa',
  [
    body('Body').isObject().withMessage('Body is required'),
    body('Body.stkCallback').isObject().withMessage('stkCallback is required'),
    validateRequest,
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const signature = req.headers['x-mpesa-signature'] as string;
      const callback = req.body as {
        Body?: {
          stkCallback?: {
            MerchantRequestID?: string;
            CheckoutRequestID?: string;
            ResultCode?: number;
          };
        };
      };

      logger.info('MPesa callback received:', {
        merchantRequestID: callback.Body?.stkCallback?.MerchantRequestID,
        checkoutRequestID: callback.Body?.stkCallback?.CheckoutRequestID,
        resultCode: callback.Body?.stkCallback?.ResultCode,
      });

      // Process callback using webhook processor
      const result = await webhookProcessor.processMpesaCallback(callback as any, signature);

      if (result.success) {
        logger.info('MPesa callback processed successfully:', {
          transactionId: result.transactionId,
          amountSats: result.amountSats,
          amountKes: result.amountKes,
        });
      } else {
        logger.warn('MPesa callback processing failed:', {
          error: result.error,
          message: result.message,
        });
      }

      // Always respond with success to MPesa (even if processing failed)
      // MPesa will retry if we return an error status
      res.json({
        success: true,
        message: 'Callback processed',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MPesa callback processing failed:', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Callback processing failed',
      });
    }
  }
);

// Airtime Purchase Callback
router.post(
  '/airtime',
  [
    body('transactionId').isString().withMessage('Transaction ID is required'),
    body('status').isIn(['success', 'failed']).withMessage('Status must be success or failed'),
    body('amount').isNumeric().withMessage('Amount is required'),
    body('phoneNumber').isString().withMessage('Phone number is required'),
    body('provider').isString().withMessage('Provider is required'),
    validateRequest,
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const signature = req.headers['x-signature'] as string;
      const callback = req.body as {
        transactionId?: string;
        status?: string;
        amount?: number;
        phoneNumber?: string;
        provider?: string;
        message?: string;
      };

      logger.info('Airtime callback received:', {
        transactionId: callback.transactionId,
        status: callback.status,
        amount: callback.amount,
        phoneNumber: callback.phoneNumber,
        provider: callback.provider,
      });

      // Process callback using webhook processor
      const result = await webhookProcessor.processAirtimeCallback(callback as any, signature);

      if (result.success) {
        logger.info('Airtime callback processed successfully:', {
          transactionId: callback.transactionId,
        });
      } else {
        logger.warn('Airtime callback processing failed:', {
          error: result.error,
          message: result.message,
        });
      }

      res.json({
        success: true,
        message: 'Callback processed',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Airtime callback processing failed:', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Callback processing failed',
      });
    }
  }
);

// MPesa Payout Callback
router.post('/mpesa/payout', async (req: express.Request, res: express.Response) => {
  try {
    const signature = req.headers['x-mpesa-signature'] as string;
    const callback = req.body as {
      OriginatorConversationID?: string;
      ConversationID?: string;
      ResultCode?: number;
      ResultDesc?: string;
    };

    logger.info('MPesa payout callback received:', {
      originatorConversationID: callback.OriginatorConversationID,
      conversationID: callback.ConversationID,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc,
    });

    // Process callback using webhook processor
    const result = await webhookProcessor.processMpesaPayoutCallback(callback as any, signature);

    if (result.success) {
      logger.info('MPesa payout callback processed successfully:', {
        originatorConversationID: callback.OriginatorConversationID,
        conversationID: callback.ConversationID,
      });
    } else {
      logger.warn('MPesa payout callback processing failed:', {
        error: result.error,
        message: result.message,
      });
    }

    res.json({
      success: true,
      message: 'Payout callback processed',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('MPesa payout callback processing failed:', { error: errorMessage });
    res.status(500).json({
      success: false,
      error: 'Payout callback processing failed',
    });
  }
});

// Health check for webhooks
router.get('/health', (req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: 'Webhook service is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
