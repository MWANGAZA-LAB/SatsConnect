import { Router, Request, Response } from 'express';
import walletService from '../services/walletService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  validateCreateWallet,
  validateWalletId,
  validateNewInvoice,
  validateSendPayment,
  validateBuyAirtime,
} from '../middleware/validation';
import logger from '../utils/logger';

const router = Router();

// Apply authentication to all wallet routes
router.use(authenticateToken);

// POST /api/wallet/create
router.post('/create', validateCreateWallet, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { label, mnemonic } = req.body;
    
    logger.info('Creating wallet', {
      userId: req.user?.id,
      label,
      hasMnemonic: !!mnemonic,
    });

    const result = await walletService.createWallet({
      label,
      mnemonic,
    });

    if (result.success) {
      logger.info('Wallet created successfully', {
        userId: req.user?.id,
        nodeId: result.data?.node_id,
      });
      
      res.status(201).json({
        success: true,
        message: 'Wallet created successfully',
        data: result.data,
      });
    } else {
      logger.error('Wallet creation failed', {
        userId: req.user?.id,
        error: result.error,
      });
      
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to create wallet',
      });
    }
  } catch (error) {
    logger.error('Unexpected error in wallet creation', {
      error: error.message,
      userId: req.user?.id,
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// GET /api/wallet/balance/:id
router.get('/balance/:id', validateWalletId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: walletId } = req.params;
    
    logger.info('Getting wallet balance', {
      userId: req.user?.id,
      walletId,
    });

    const result = await walletService.getBalance();

    if (result.success) {
      logger.info('Balance retrieved successfully', {
        userId: req.user?.id,
        walletId,
        confirmedSats: result.data?.confirmed_sats,
        lightningSats: result.data?.lightning_sats,
      });
      
      res.status(200).json({
        success: true,
        message: 'Balance retrieved successfully',
        data: result.data,
      });
    } else {
      logger.error('Balance retrieval failed', {
        userId: req.user?.id,
        walletId,
        error: result.error,
      });
      
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to retrieve balance',
      });
    }
  } catch (error) {
    logger.error('Unexpected error in balance retrieval', {
      error: error.message,
      userId: req.user?.id,
      walletId: req.params.id,
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// POST /api/wallet/invoice/new
router.post('/invoice/new', validateNewInvoice, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount_sats, memo } = req.body;
    
    logger.info('Creating new invoice', {
      userId: req.user?.id,
      amountSats: amount_sats,
      memo,
    });

    const result = await walletService.newInvoice({
      amount_sats,
      memo,
    });

    if (result.success) {
      logger.info('Invoice created successfully', {
        userId: req.user?.id,
        amountSats: amount_sats,
        paymentHash: result.data?.payment_hash,
      });
      
      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: result.data,
      });
    } else {
      logger.error('Invoice creation failed', {
        userId: req.user?.id,
        amountSats: amount_sats,
        error: result.error,
      });
      
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to create invoice',
      });
    }
  } catch (error) {
    logger.error('Unexpected error in invoice creation', {
      error: error.message,
      userId: req.user?.id,
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// POST /api/wallet/payment/send
router.post('/payment/send', validateSendPayment, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { invoice } = req.body;
    
    logger.info('Sending payment', {
      userId: req.user?.id,
      invoice: invoice.substring(0, 50) + '...', // Log partial invoice for security
    });

    const result = await walletService.sendPayment({
      invoice,
    });

    if (result.success) {
      logger.info('Payment sent successfully', {
        userId: req.user?.id,
        paymentHash: result.data?.payment_hash,
        status: result.data?.status,
      });
      
      res.status(200).json({
        success: true,
        message: 'Payment sent successfully',
        data: result.data,
      });
    } else {
      logger.error('Payment sending failed', {
        userId: req.user?.id,
        error: result.error,
      });
      
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send payment',
      });
    }
  } catch (error) {
    logger.error('Unexpected error in payment sending', {
      error: error.message,
      userId: req.user?.id,
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// POST /api/wallet/airtime/buy
router.post('/airtime/buy', validateBuyAirtime, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount_sats, phone_number, provider } = req.body;
    
    logger.info('Buying airtime', {
      userId: req.user?.id,
      amountSats: amount_sats,
      phoneNumber: phone_number,
      provider,
    });

    const result = await walletService.buyAirtime({
      amount_sats,
      phone_number,
      provider,
    });

    if (result.success) {
      logger.info('Airtime purchase initiated successfully', {
        userId: req.user?.id,
        amountSats: amount_sats,
        phoneNumber: phone_number,
        paymentHash: result.data?.payment_hash,
      });
      
      res.status(201).json({
        success: true,
        message: 'Airtime purchase initiated successfully',
        data: result.data,
      });
    } else {
      logger.error('Airtime purchase failed', {
        userId: req.user?.id,
        amountSats: amount_sats,
        phoneNumber: phone_number,
        error: result.error,
      });
      
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to initiate airtime purchase',
      });
    }
  } catch (error) {
    logger.error('Unexpected error in airtime purchase', {
      error: error.message,
      userId: req.user?.id,
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;