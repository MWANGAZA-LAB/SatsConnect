import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Secure Configuration Manager
 * Handles encryption/decryption of sensitive environment variables
 */
export class SecureConfigManager {
  private static instance: SecureConfigManager;
  private encryptionKey: string;
  private configPath: string;
  private encryptedConfigPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), '.env');
    this.encryptedConfigPath = path.join(process.cwd(), '.env.encrypted');
    
    // Generate or load encryption key
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  public static getInstance(): SecureConfigManager {
    if (!SecureConfigManager.instance) {
      SecureConfigManager.instance = new SecureConfigManager();
    }
    return SecureConfigManager.instance;
  }

  /**
   * Get or create encryption key for config encryption
   */
  private getOrCreateEncryptionKey(): string {
    const keyPath = path.join(process.cwd(), '.config.key');
    
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf8');
    }

    // Generate new key
    const key = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, key, { mode: 0o600 }); // Read/write for owner only
    logger.info('Generated new encryption key for secure config');
    return key;
  }

  /**
   * Encrypt sensitive configuration values
   */
  public encryptConfig(config: Record<string, string>): string {
    const sensitiveKeys = [
      'JWT_SECRET',
      'MPESA_CONSUMER_SECRET',
      'MPESA_PASSKEY',
      'CHIMONEY_API_KEY',
      'CHIMONEY_SUB_KEY',
      'REDIS_PASSWORD',
    ];

    const encryptedConfig: Record<string, string> = {};

    for (const [key, value] of Object.entries(config)) {
      if (sensitiveKeys.includes(key) && value) {
        // Encrypt sensitive values
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        encryptedConfig[key] = `encrypted:${iv.toString('hex')}:${encrypted}`;
      } else {
        // Keep non-sensitive values as-is
        encryptedConfig[key] = value;
      }
    }

    return JSON.stringify(encryptedConfig, null, 2);
  }

  /**
   * Decrypt configuration values
   */
  public decryptConfig(encryptedConfig: string): Record<string, string> {
    const config = JSON.parse(encryptedConfig);
    const decryptedConfig: Record<string, string> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.startsWith('encrypted:')) {
        try {
          const parts = value.split(':');
          if (parts.length === 3) {
            const iv = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            decryptedConfig[key] = decrypted;
          } else {
            logger.warn(`Invalid encrypted config format for key: ${key}`);
            decryptedConfig[key] = value;
          }
        } catch (error) {
          logger.error(`Failed to decrypt config for key: ${key}`, { error });
          decryptedConfig[key] = value;
        }
      } else {
        decryptedConfig[key] = value as string;
      }
    }

    return decryptedConfig;
  }

  /**
   * Load and decrypt configuration
   */
  public loadSecureConfig(): Record<string, string> {
    if (fs.existsSync(this.encryptedConfigPath)) {
      try {
        const encryptedConfig = fs.readFileSync(this.encryptedConfigPath, 'utf8');
        return this.decryptConfig(encryptedConfig);
      } catch (error) {
        logger.error('Failed to load encrypted config, falling back to .env', { error });
      }
    }

    // Fallback to regular .env file
    if (fs.existsSync(this.configPath)) {
      const envContent = fs.readFileSync(this.configPath, 'utf8');
      const config: Record<string, string> = {};
      
      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            config[key] = valueParts.join('=');
          }
        }
      });
      
      return config;
    }

    logger.warn('No configuration file found, using environment variables');
    return {};
  }

  /**
   * Save encrypted configuration
   */
  public saveEncryptedConfig(config: Record<string, string>): void {
    const encryptedConfig = this.encryptConfig(config);
    fs.writeFileSync(this.encryptedConfigPath, encryptedConfig, { mode: 0o600 });
    logger.info('Saved encrypted configuration');
  }

  /**
   * Validate that sensitive data is not stored in plain text
   */
  public validateSecurity(): boolean {
    const config = this.loadSecureConfig();
    const sensitiveKeys = [
      'JWT_SECRET',
      'MPESA_CONSUMER_SECRET',
      'MPESA_PASSKEY',
      'CHIMONEY_API_KEY',
      'CHIMONEY_SUB_KEY',
    ];

    let isSecure = true;

    for (const key of sensitiveKeys) {
      const value = config[key];
      if (value && !value.startsWith('encrypted:')) {
        logger.error(`Sensitive data found in plain text: ${key}`);
        isSecure = false;
      }
    }

    if (isSecure) {
      logger.info('Configuration security validation passed');
    } else {
      logger.error('Configuration security validation failed - sensitive data found in plain text');
    }

    return isSecure;
  }

  /**
   * Ensure seeds/keys are never stored on backend
   */
  public validateNoSeedsStored(): boolean {
    const config = this.loadSecureConfig();
    const seedKeys = ['MNEMONIC', 'SEED_PHRASE', 'PRIVATE_KEY', 'WALLET_SEED'];

    let noSeedsStored = true;

    for (const key of seedKeys) {
      if (config[key]) {
        logger.error(`Seed/key data found in backend config: ${key} - This is a security violation!`);
        noSeedsStored = false;
      }
    }

    if (noSeedsStored) {
      logger.info('No seed/key data found in backend configuration - security validation passed');
    }

    return noSeedsStored;
  }
}

export const secureConfigManager = SecureConfigManager.getInstance();
