import dotenv from 'dotenv';
import { validateSecurity, validateNoSeedsStored } from './secureConfig';

// Load environment variables
dotenv.config();

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
  bitcoin: {
    rpcUrl: string;
    rpcUser: string;
    rpcPassword: string;
    network: 'mainnet' | 'testnet' | 'regtest';
  };
  exchangeRates: {
    coinMarketCapApiKey: string;
    cacheDuration: number;
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
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  rustEngine: {
    grpcUrl: process.env.RUST_ENGINE_GRPC_URL || '127.0.0.1:50051',
    useTls: process.env.RUST_ENGINE_GRPC_USE_TLS === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  },
  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    businessShortCode: process.env.MPESA_BUSINESS_SHORT_CODE || '174379',
    passkey: process.env.MPESA_PASSKEY || '',
    callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://your-domain.com/webhook/mpesa',
    environment: (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  },
  airtime: {
    provider: (process.env.AIRTIME_PROVIDER as 'chimoney' | 'kotanipay' | 'bitnob') || 'chimoney',
    chimoneyApiKey: process.env.CHIMONEY_API_KEY || '',
    chimoneySubKey: process.env.CHIMONEY_SUB_KEY || '',
    webhookUrl: process.env.CHIMONEY_WEBHOOK_URL || 'https://your-domain.com/webhook/airtime',
  },
  bitcoin: {
    rpcUrl: process.env.BITCOIN_RPC_URL || 'http://127.0.0.1:18332',
    rpcUser: process.env.BITCOIN_RPC_USER || 'user',
    rpcPassword: process.env.BITCOIN_RPC_PASSWORD || 'password',
    network: (process.env.BITCOIN_NETWORK as 'mainnet' | 'testnet' | 'regtest') || 'testnet',
  },
  exchangeRates: {
    coinMarketCapApiKey: process.env.COINMARKETCAP_API_KEY || '',
    cacheDuration: parseInt(process.env.EXCHANGE_RATE_CACHE_DURATION || '300000', 10), // 5 minutes
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    retryAttempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS || '3', 10),
  },
};

// Validate security on startup
if (process.env.NODE_ENV === 'production') {
  validateSecurity();
  validateNoSeedsStored();
}

export default config;
