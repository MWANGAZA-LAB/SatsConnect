import crypto from 'crypto';
import config from '../config';
import logger from '../utils/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: Buffer;

  private constructor() {
    // In production, this should come from a secure key management system
    this.masterKey = this.deriveKey(config.jwt.secret);
  }

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  private deriveKey(password: string, salt?: Buffer): Buffer {
    const saltBuffer = salt || crypto.randomBytes(SALT_LENGTH);
    return crypto.pbkdf2Sync(password, saltBuffer as Uint8Array, 100000, 32, 'sha512');
  }

  public encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = this.deriveKey(config.jwt.secret, salt);

      const cipher = crypto.createCipher(ALGORITHM, key as Uint8Array);
      cipher.setAAD(salt as Uint8Array);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      // Combine salt + iv + tag + encrypted data
      const combined = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')] as Uint8Array[]);

      return combined.toString('base64');
    } catch (error) {
      logger.error('Encryption failed', { error: error.message });
      throw new Error('Encryption failed');
    }
  }

  public decrypt(encryptedData: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract components
      const salt = combined.subarray(0, SALT_LENGTH);
      const iv = combined.subarray(SALT_LENGTH, TAG_POSITION);
      const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION);
      const encrypted = combined.subarray(ENCRYPTED_POSITION);

      const key = this.deriveKey(config.jwt.secret, salt);

      const decipher = crypto.createDecipher(ALGORITHM, key as Uint8Array);
      decipher.setAAD(salt as Uint8Array);
      decipher.setAuthTag(tag as Uint8Array);

      let decrypted = decipher.update(encrypted as Uint8Array, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error('Decryption failed');
    }
  }

  public hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  public generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  public verifyHash(text: string, hash: string): boolean {
    const computedHash = this.hash(text);
    return crypto.timingSafeEqual(Buffer.from(computedHash) as Uint8Array, Buffer.from(hash) as Uint8Array);
  }
}

export const encryptionService = EncryptionService.getInstance();

// Utility functions for sensitive data redaction
export const redactSensitiveData = (data: unknown): unknown => {
  if (typeof data === 'string') {
    // Redact phone numbers
    if (data.match(/^\d{10,15}$/)) {
      return data.substring(0, 3) + '****' + data.substring(data.length - 3);
    }
    // Redact email addresses
    if (data.includes('@')) {
      const [local, domain] = data.split('@');
      return local.substring(0, 2) + '****@' + domain;
    }
    // Redact JWT tokens
    if (data.startsWith('eyJ')) {
      return data.substring(0, 20) + '...';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  if (data && typeof data === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('key') ||
        lowerKey.includes('token') ||
        lowerKey.includes('phone') ||
        lowerKey.includes('email')
      ) {
        redacted[key] = redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  return data;
};

// Secure configuration loader
export const loadSecureConfig = () => {
  const sensitiveKeys = [
    'MPESA_CONSUMER_SECRET',
    'MPESA_PASSKEY',
    'CHIMONEY_API_KEY',
    'CHIMONEY_SUB_KEY',
    'JWT_SECRET',
    'REDIS_PASSWORD',
  ];

  const secureConfig: Record<string, string> = {};

  for (const key of sensitiveKeys) {
    const value = process.env[key];
    if (value) {
      // In production, these should be encrypted
      if (process.env.NODE_ENV === 'production') {
        try {
          secureConfig[key] = encryptionService.decrypt(value);
        } catch (error) {
          logger.warn(`Failed to decrypt ${key}, using plain value`, { error: error.message });
          secureConfig[key] = value;
        }
      } else {
        secureConfig[key] = value;
      }
    }
  }

  return secureConfig;
};
