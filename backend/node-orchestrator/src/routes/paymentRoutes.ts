import { Router, Request, Response } from 'express';
import paymentService from '../services/paymentService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  validateProcessPayment,
  validatePaymentId,
  validateRefundPayment,
} from '../middleware/validation';
import logger from '../utils/logger';

const router = Router();

// Apply authentication to all payment routes
router.use(authenticateToken);

// POST /api/payments/process
router.post(
  '/process',
  validateProcessPayment,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { payment_id, wallet_id, amount_sats, invoice, description } = req.body;

      logger.info('Processing payment', {
        userId: req.user?.id,
        paymentId: payment_id,
        walletId: wallet_id,
        amountSats: amount_sats,
        invoice: invoice.substring(0, 50) + '...', // Log partial invoice for security
      });

      const result = await paymentService.processPayment({
        payment_id,
        wallet_id,
        amount_sats,
        invoice,
        description,
      });

      if (result.success) {
        logger.info('Payment processed successfully', {
          userId: req.user?.id,
          paymentId: result.data?.payment_id,
          status: result.data?.status,
          amountSats: result.data?.amount_sats,
        });

        res.status(201).json({
          success: true,
          message: 'Payment processed successfully',
          data: result.data,
        });
      } else {
        logger.error('Payment processing failed', {
          userId: req.user?.id,
          paymentId: payment_id,
          error: result.error,
        });

        res.status(400).json({
          success: false,
          error: result.error || 'Failed to process payment',
        });
      }
    } catch (error) {
      logger.error('Unexpected error in payment processing', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

// GET /api/payments/:id/status
router.get('/:id/status', validatePaymentId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: paymentId } = req.params;

    logger.info('Getting payment status', {
      userId: req.user?.id,
      paymentId,
    });

    const result = await paymentService.getPaymentStatus({
      payment_id: paymentId,
    });

    if (result.success) {
      logger.info('Payment status retrieved successfully', {
        userId: req.user?.id,
        paymentId,
        status: result.data?.status,
      });

      res.status(200).json({
        success: true,
        message: 'Payment status retrieved successfully',
        data: result.data,
      });
    } else {
      logger.error('Payment status retrieval failed', {
        userId: req.user?.id,
        paymentId,
        error: result.error,
      });

      res.status(400).json({
        success: false,
        error: result.error || 'Failed to retrieve payment status',
      });
    }
  } catch (error) {
    logger.error('Unexpected error in payment status retrieval', {
      error: error.message,
      userId: req.user?.id,
      paymentId: req.params.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// POST /api/payments/:id/refund
router.post(
  '/:id/refund',
  validatePaymentId,
  validateRefundPayment,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: paymentId } = req.params;
      const { amount_sats } = req.body;

      logger.info('Processing refund', {
        userId: req.user?.id,
        paymentId,
        amountSats: amount_sats,
      });

      const result = await paymentService.refundPayment({
        payment_id: paymentId,
        amount_sats,
      });

      if (result.success) {
        logger.info('Refund processed successfully', {
          userId: req.user?.id,
          paymentId,
          status: result.data?.status,
          amountSats: result.data?.amount_sats,
        });

        res.status(200).json({
          success: true,
          message: 'Refund processed successfully',
          data: result.data,
        });
      } else {
        logger.error('Refund processing failed', {
          userId: req.user?.id,
          paymentId,
          error: result.error,
        });

        res.status(400).json({
          success: false,
          error: result.error || 'Failed to process refund',
        });
      }
    } catch (error) {
      logger.error('Unexpected error in refund processing', {
        error: error.message,
        userId: req.user?.id,
        paymentId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

export default router;
