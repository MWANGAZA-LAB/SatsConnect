import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import logger from '../utils/logger';

// Enhanced phone number sanitization
const sanitizePhoneNumber = (phone: string): string => {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure Kenyan format (+254XXXXXXXXX)
  if (cleaned.startsWith('254')) {
    return '+' + cleaned;
  } else if (cleaned.startsWith('+254')) {
    return cleaned;
  } else if (cleaned.startsWith('0')) {
    return '+254' + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    return '+254' + cleaned;
  }
  
  return cleaned;
};

// Enhanced amount sanitization
const sanitizeAmount = (amount: string | number): number => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Round to 2 decimal places for currency
  return Math.round(numAmount * 100) / 100;
};

// Enhanced string sanitization
const sanitizeString = (str: string): string => {
  return str
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
};

// Sanitize request data middleware
export const sanitizeRequestData = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize phone numbers
  if (req.body.phoneNumber) {
    req.body.phoneNumber = sanitizePhoneNumber(req.body.phoneNumber);
  }
  if (req.body.phone_number) {
    req.body.phone_number = sanitizePhoneNumber(req.body.phone_number);
  }

  // Sanitize amounts
  if (req.body.amount) {
    req.body.amount = sanitizeAmount(req.body.amount);
  }
  if (req.body.amount_sats) {
    req.body.amount_sats = sanitizeAmount(req.body.amount_sats);
  }

  // Sanitize string fields
  const stringFields = ['label', 'description', 'memo', 'accountReference', 'transactionDesc', 'reference'];
  stringFields.forEach(field => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      req.body[field] = sanitizeString(req.body[field]);
    }
  });

  // Sanitize wallet ID and payment ID
  if (req.body.walletId) {
    req.body.walletId = sanitizeString(req.body.walletId);
  }
  if (req.body.payment_id) {
    req.body.payment_id = sanitizeString(req.body.payment_id);
  }

  next();
};

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
  sanitizeRequestData,
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
  sanitizeRequestData,
  param('id')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Wallet ID must be a string between 1 and 100 characters'),
  handleValidationErrors,
];

export const validateNewInvoice = [
  sanitizeRequestData,
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
  sanitizeRequestData,
  body('invoice')
    .isString()
    .matches(/^lnbc\d+[munp]1[0-9a-z]+$/)
    .withMessage('Invoice must be a valid BOLT11 Lightning invoice'),
  handleValidationErrors,
];

export const validateBuyAirtime = [
  sanitizeRequestData,
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
  sanitizeRequestData,
  param('id')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Payment ID must be a string between 1 and 100 characters'),
  handleValidationErrors,
];

export const validateProcessPayment = [
  sanitizeRequestData,
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
  sanitizeRequestData,
  body('amount_sats')
    .isInt({ min: 1, max: 2100000000000000 })
    .withMessage('Amount must be a positive integer not exceeding 21M sats'),
  handleValidationErrors,
];
