import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import logger from '../utils/logger';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      errors: errors.array(),
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip,
    });

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((error) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
      })),
    });
    return;
  }

  next();
};

// Wallet validation rules
export const validateCreateWallet = [
  body('label')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Label must be a string between 1 and 100 characters'),
  body('mnemonic')
    .optional()
    .isString()
    .isLength({ min: 12, max: 24 })
    .withMessage('Mnemonic must be a string between 12 and 24 words'),
  handleValidationErrors,
];

export const validateWalletId = [
  param('id')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Wallet ID must be a string between 1 and 100 characters'),
  handleValidationErrors,
];

export const validateNewInvoice = [
  body('amount_sats')
    .isInt({ min: 0, max: 2100000000000000 })
    .withMessage('Amount must be a positive integer not exceeding 21M sats'),
  body('memo')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Memo must be a string not exceeding 1000 characters'),
  handleValidationErrors,
];

export const validateSendPayment = [
  body('invoice')
    .isString()
    .matches(/^lnbc\d+[munp]1[0-9a-z]+$/)
    .withMessage('Invoice must be a valid BOLT11 Lightning invoice'),
  handleValidationErrors,
];

export const validateBuyAirtime = [
  body('amount_sats')
    .isInt({ min: 1, max: 1000000 })
    .withMessage('Amount must be between 1 and 1M sats'),
  body('phone_number')
    .isString()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be a valid international format'),
  body('provider')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Provider must be a string between 1 and 50 characters'),
  handleValidationErrors,
];

export const validatePaymentId = [
  param('id')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Payment ID must be a string between 1 and 100 characters'),
  handleValidationErrors,
];

export const validateProcessPayment = [
  body('wallet_id')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Wallet ID must be a string between 1 and 100 characters'),
  body('amount_sats')
    .isInt({ min: 1, max: 2100000000000000 })
    .withMessage('Amount must be a positive integer not exceeding 21M sats'),
  body('invoice')
    .isString()
    .matches(/^lnbc\d+[munp]1[0-9a-z]+$/)
    .withMessage('Invoice must be a valid BOLT11 Lightning invoice'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Description must be a string not exceeding 1000 characters'),
  handleValidationErrors,
];

export const validateRefundPayment = [
  body('amount_sats')
    .isInt({ min: 1, max: 2100000000000000 })
    .withMessage('Amount must be a positive integer not exceeding 21M sats'),
  handleValidationErrors,
];
