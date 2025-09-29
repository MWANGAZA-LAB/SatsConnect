import dotenv from 'dotenv';
import { secureConfigManager } from './secureConfig';

// Load environment variables
dotenv.config();

// Load secure configuration
const secureConfig = secureConfigManager.loadSecureConfig();

// Merge secure config with environment variables
const mergedConfig = { ...process.env, ...secureConfig };

export interface Config {
  server: {
    port: number;
    nodeEnv: string;
  };
  rustEngine: {
    grpcUrl: string;
    useTls: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
    file: string;
  };
  cors: {
    origin: string;
  };
  security: {
    bcryptRounds: number;
  };
  mpesa: {
    consumerKey: string;
    consumerSecret: string;
    businessShortCode: string;
    passkey: string;
    callbackUrl: string;
    environment: 'sandbox' | 'production';
  };
  airtime: {
    provider: 'chimoney' | 'kotanipay' | 'bitnob';
    chimoneyApiKey: string;
    chimoneySubKey: string;
    webhookUrl: string;
  };
  redis: {
    url: string;
    password?: string;
  };
  queue: {
    concurrency: number;
    retryAttempts: number;
  };
}

const config: Config = {
  server: {
    port: parseInt(mergedConfig.PORT || '4000', 10),
    nodeEnv: mergedConfig.NODE_ENV || 'development',
  },
  rustEngine: {
    grpcUrl: mergedConfig.RUST_ENGINE_GRPC_URL || '127.0.0.1:50051',
    useTls: mergedConfig.RUST_ENGINE_GRPC_USE_TLS === 'true',
  },
  jwt: {
    secret: mergedConfig.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: mergedConfig.JWT_EXPIRES_IN || '24h',
  },
  rateLimit: {
    windowMs: parseInt(mergedConfig.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(mergedConfig.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  logging: {
    level: mergedConfig.LOG_LEVEL || 'info',
    file: mergedConfig.LOG_FILE || 'logs/app.log',
  },
  cors: {
    origin: mergedConfig.CORS_ORIGIN || 'http://localhost:3000',
  },
  security: {
    bcryptRounds: parseInt(mergedConfig.BCRYPT_ROUNDS || '12', 10),
  },
  mpesa: {
    consumerKey: mergedConfig.MPESA_CONSUMER_KEY || '',
    consumerSecret: mergedConfig.MPESA_CONSUMER_SECRET || '',
    businessShortCode: mergedConfig.MPESA_BUSINESS_SHORT_CODE || '174379',
    passkey: mergedConfig.MPESA_PASSKEY || '',
    callbackUrl: mergedConfig.MPESA_CALLBACK_URL || 'https://your-domain.com/webhook/mpesa',
    environment: (mergedConfig.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  },
  airtime: {
    provider: (mergedConfig.AIRTIME_PROVIDER as 'chimoney' | 'kotanipay' | 'bitnob') || 'chimoney',
    chimoneyApiKey: mergedConfig.CHIMONEY_API_KEY || '',
    chimoneySubKey: mergedConfig.CHIMONEY_SUB_KEY || '',
    webhookUrl: mergedConfig.CHIMONEY_WEBHOOK_URL || 'https://your-domain.com/webhook/airtime',
  },
  redis: {
    url: mergedConfig.REDIS_URL || 'redis://localhost:6379',
    password: mergedConfig.REDIS_PASSWORD,
  },
  queue: {
    concurrency: parseInt(mergedConfig.QUEUE_CONCURRENCY || '5', 10),
    retryAttempts: parseInt(mergedConfig.QUEUE_RETRY_ATTEMPTS || '3', 10),
  },
};

// Validate security on startup
if (process.env.NODE_ENV === 'production') {
  secureConfigManager.validateSecurity();
  secureConfigManager.validateNoSeedsStored();
}

export default config;
