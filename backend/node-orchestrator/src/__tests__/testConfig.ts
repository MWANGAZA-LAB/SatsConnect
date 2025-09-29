// Test configuration that overrides production settings
export const testConfig = {
  server: {
    port: 4001, // Use different port for tests
    nodeEnv: 'test',
  },
  redis: {
    url: 'redis://localhost:6379',
    password: '',
    // Disable Redis for tests to avoid version issues
    enabled: false,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increase limit for tests
    message: 'Too many requests from this IP, please try again later.',
  },
  jwt: {
    secret: 'test-secret-key-for-testing-only',
    expiresIn: '1h',
  },
  logging: {
    level: 'error', // Reduce log noise during tests
  },
};

export default testConfig;
