import express from 'express';
import { body, validationResult } from 'express-validator';
import mpesaService from '../services/mpesaService';
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
      const callback: any = req.body;

      logger.info('MPesa callback received:', {
        merchantRequestID: callback.Body?.stkCallback?.MerchantRequestID,
        checkoutRequestID: callback.Body?.stkCallback?.CheckoutRequestID,
        resultCode: callback.Body?.stkCallback?.ResultCode,
      });

      // Validate callback signature
      if (!mpesaService.validateCallback(callback, signature)) {
        logger.warn('Invalid MPesa callback signature');
        return res.status(400).json({
          success: false,
          error: 'Invalid signature',
        });
      }

      // Extract transaction details
      const transactionDetails = mpesaService.extractTransactionDetails(callback);

      logger.info('MPesa transaction details:', transactionDetails);

      if (transactionDetails.resultCode === 0) {
        // Transaction successful
        logger.info('MPesa transaction successful:', {
          mpesaReceiptNumber: transactionDetails.mpesaReceiptNumber,
          amount: transactionDetails.amount,
          phoneNumber: transactionDetails.phoneNumber,
        });

        // TODO: Process successful payment
        // 1. Verify the payment with MPesa
        // 2. Generate Lightning invoice for the equivalent BTC amount
        // 3. Send BTC to user's wallet
        // 4. Update transaction status in database
        // 5. Send notification to user

        // For now, just log the success
        logger.info('MPesa payment processed successfully', {
          checkoutRequestID: transactionDetails.checkoutRequestID,
          amount: transactionDetails.amount,
          mpesaReceiptNumber: transactionDetails.mpesaReceiptNumber,
        });
      } else {
        // Transaction failed
        logger.warn('MPesa transaction failed:', {
          resultCode: transactionDetails.resultCode,
          resultDesc: transactionDetails.resultDesc,
          checkoutRequestID: transactionDetails.checkoutRequestID,
        });

        // TODO: Handle failed transaction
        // 1. Update transaction status to failed
        // 2. Send notification to user
        // 3. Log the failure reason
      }

      // Always respond with success to MPesa
      res.json({
        success: true,
        message: 'Callback processed',
      });
    } catch (error: any) {
      logger.error('MPesa callback processing failed:', error);
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
      const callback: any = req.body;

      logger.info('Airtime callback received:', {
        transactionId: callback.transactionId,
        status: callback.status,
        amount: callback.amount,
        phoneNumber: callback.phoneNumber,
        provider: callback.provider,
      });

      // Validate callback signature
      if (!airtimeService.validateCallback(callback, signature)) {
        logger.warn('Invalid airtime callback signature');
        return res.status(400).json({
          success: false,
          error: 'Invalid signature',
        });
      }

      if (callback.status === 'success') {
        // Airtime purchase successful
        logger.info('Airtime purchase successful:', {
          transactionId: callback.transactionId,
          amount: callback.amount,
          phoneNumber: callback.phoneNumber,
          provider: callback.provider,
        });

        // TODO: Process successful airtime purchase
        // 1. Verify the airtime was actually delivered
        // 2. Process the Lightning payment
        // 3. Update transaction status in database
        // 4. Send notification to user

        // For now, just log the success
        logger.info('Airtime purchase processed successfully', {
          transactionId: callback.transactionId,
          amount: callback.amount,
          phoneNumber: callback.phoneNumber,
          provider: callback.provider,
        });
      } else {
        // Airtime purchase failed
        logger.warn('Airtime purchase failed:', {
          transactionId: callback.transactionId,
          status: callback.status,
          message: callback.message,
        });

        // TODO: Handle failed airtime purchase
        // 1. Update transaction status to failed
        // 2. Refund the Lightning payment if possible
        // 3. Send notification to user
        // 4. Log the failure reason
      }

      res.json({
        success: true,
        message: 'Callback processed',
      });
    } catch (error: any) {
      logger.error('Airtime callback processing failed:', error);
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
    const callback: any = req.body;

    logger.info('MPesa payout callback received:', {
      originatorConversationID: callback.OriginatorConversationID,
      conversationID: callback.ConversationID,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc,
    });

    // Validate callback signature
    if (!mpesaService.validateCallback(callback, signature)) {
      logger.warn('Invalid MPesa payout callback signature');
      return res.status(400).json({
        success: false,
        error: 'Invalid signature',
      });
    }

    if (callback.ResultCode === 0) {
      // Payout successful
      logger.info('MPesa payout successful:', {
        originatorConversationID: callback.OriginatorConversationID,
        conversationID: callback.ConversationID,
        amount: callback.ResultParameters?.ResultParameter?.[0]?.Value,
        phoneNumber: callback.ResultParameters?.ResultParameter?.[1]?.Value,
      });

      // TODO: Process successful payout
      // 1. Verify the payout with MPesa
      // 2. Process the Lightning payment
      // 3. Update transaction status in database
      // 4. Send notification to user
    } else {
      // Payout failed
      logger.warn('MPesa payout failed:', {
        resultCode: callback.ResultCode,
        resultDesc: callback.ResultDesc,
        originatorConversationID: callback.OriginatorConversationID,
      });

      // TODO: Handle failed payout
      // 1. Update transaction status to failed
      // 2. Refund the Lightning payment if possible
      // 3. Send notification to user
    }

    res.json({
      success: true,
      message: 'Payout callback processed',
    });
  } catch (error: any) {
    logger.error('MPesa payout callback processing failed:', error);
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
