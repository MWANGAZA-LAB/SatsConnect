import express from 'express';
import { Request, Response } from 'express';
import bitcoinOperationsService from '../services/bitcoinOperationsService';
import logger from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get Bitcoin exchange rate
router.get('/exchange-rate', async (req: Request, res: Response) => {
  try {
    const exchangeRate = await bitcoinOperationsService.getExchangeRate();
    
    res.json({
      success: true,
      data: exchangeRate,
    });
  } catch (error) {
    logger.error('Failed to get exchange rate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exchange rate',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Convert KES to Satoshis
router.post('/convert/kes-to-sats', async (req: Request, res: Response) => {
  try {
    const { amountKes } = req.body;
    
    if (!amountKes || typeof amountKes !== 'number' || amountKes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be a positive number.',
      });
    }

    const amountSats = await bitcoinOperationsService.convertKesToSats(amountKes);
    
    res.json({
      success: true,
      data: {
        amountKes,
        amountSats,
        exchangeRate: await bitcoinOperationsService.getExchangeRate().then(r => r.rate),
      },
    });
  } catch (error) {
    logger.error('Failed to convert KES to Sats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert KES to Satoshis',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Convert Satoshis to KES
router.post('/convert/sats-to-kes', async (req: Request, res: Response) => {
  try {
    const { amountSats } = req.body;
    
    if (!amountSats || typeof amountSats !== 'number' || amountSats <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be a positive number.',
      });
    }

    const amountKes = await bitcoinOperationsService.convertSatsToKes(amountSats);
    
    res.json({
      success: true,
      data: {
        amountSats,
        amountKes,
        exchangeRate: await bitcoinOperationsService.getExchangeRate().then(r => r.rate),
      },
    });
  } catch (error) {
    logger.error('Failed to convert Sats to KES:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert Satoshis to KES',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Credit Bitcoin to user wallet
router.post('/credit', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, amountKes, mpesaReceiptNumber, walletAddress } = req.body;
    const userId = req.user?.id;

    if (!phoneNumber || !amountKes || !mpesaReceiptNumber || !walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: phoneNumber, amountKes, mpesaReceiptNumber, walletAddress',
      });
    }

    if (typeof amountKes !== 'number' || amountKes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be a positive number.',
      });
    }

    const exchangeRate = await bitcoinOperationsService.getExchangeRate();
    
    const creditRequest = {
      phoneNumber,
      amountKes,
      mpesaReceiptNumber,
      exchangeRate: exchangeRate.rate,
      walletAddress,
      userId: userId || phoneNumber,
    };

    const result = await bitcoinOperationsService.creditBitcoin(creditRequest);
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        data: result,
      });
    }
  } catch (error) {
    logger.error('Failed to credit Bitcoin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to credit Bitcoin',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Purchase airtime with Bitcoin
router.post('/purchase-airtime', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, amountSats, provider, walletAddress } = req.body;
    const userId = req.user?.id;

    if (!phoneNumber || !amountSats || !provider || !walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: phoneNumber, amountSats, provider, walletAddress',
      });
    }

    if (typeof amountSats !== 'number' || amountSats <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be a positive number.',
      });
    }

    if (!['Safaricom', 'Airtel', 'Telkom'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider. Must be Safaricom, Airtel, or Telkom.',
      });
    }

    const purchaseRequest = {
      phoneNumber,
      amountSats,
      provider,
      walletAddress,
      userId: userId || phoneNumber,
    };

    const result = await bitcoinOperationsService.purchaseAirtime(purchaseRequest);
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        data: result,
      });
    }
  } catch (error) {
    logger.error('Failed to purchase airtime:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to purchase airtime',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get Bitcoin balance
router.get('/balance/:walletAddress', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required',
      });
    }

    const balance = await bitcoinOperationsService.getBitcoinBalance(walletAddress);
    
    res.json({
      success: true,
      data: balance,
    });
  } catch (error) {
    logger.error('Failed to get Bitcoin balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Bitcoin balance',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get transaction history
router.get('/transactions/:walletAddress', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const { limit = 50 } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required',
      });
    }

    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit. Must be between 1 and 100.',
      });
    }

    const transactions = await bitcoinOperationsService.getTransactionHistory(walletAddress, limitNum);
    
    res.json({
      success: true,
      data: {
        transactions,
        count: transactions.length,
        limit: limitNum,
      },
    });
  } catch (error) {
    logger.error('Failed to get transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Process MPesa callback (webhook)
router.post('/webhook/mpesa', async (req: Request, res: Response) => {
  try {
    const callback = req.body;
    const signature = req.headers['x-mpesa-signature'] as string;

    // Validate callback signature
    if (!bitcoinOperationsService.validateCallback(callback, signature)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid callback signature',
      });
    }

    // Process callback and credit Bitcoin
    const result = await bitcoinOperationsService.processMpesaCallback(callback);
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        data: result,
      });
    }
  } catch (error) {
    logger.error('Failed to process MPesa callback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process MPesa callback',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get Bitcoin operations status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const exchangeRate = await bitcoinOperationsService.getExchangeRate();
    
    res.json({
      success: true,
      data: {
        status: 'operational',
        exchangeRate: exchangeRate.rate,
        lastUpdated: exchangeRate.timestamp,
        source: exchangeRate.source,
      },
    });
  } catch (error) {
    logger.error('Failed to get Bitcoin operations status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Bitcoin operations status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
