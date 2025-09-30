import { logger } from '../utils/logger';

/**
 * Simple configuration validation
 */
export const validateSecurity = (): boolean => {
  const requiredKeys = [
    'JWT_SECRET',
    'MPESA_CONSUMER_SECRET',
    'MPESA_PASSKEY',
  ];

  const missingKeys = requiredKeys.filter(key => !process.env[key]);
  
  if (missingKeys.length > 0) {
    logger.error('Missing required security configuration:', missingKeys);
    return false;
  }

  return true;
};

/**
 * Validate that no seeds are stored in backend
 */
export const validateNoSeedsStored = (): boolean => {
  const seedKeys = ['MNEMONIC', 'SEED_PHRASE', 'WALLET_SEED'];
  
  for (const key of seedKeys) {
    if (process.env[key]) {
      logger.error(`Security violation: ${key} found in backend environment`);
      return false;
    }
  }

  return true;
};