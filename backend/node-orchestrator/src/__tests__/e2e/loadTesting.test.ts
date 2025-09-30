import request from 'supertest';
import { app } from '../../index';
import { performance } from 'perf_hooks';

describe('Load Testing Suite', () => {
  let authToken: string;
  let walletId: string;

  beforeAll(async () => {
    // Get auth token
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'testpassword',
      });
    
    authToken = authResponse.body.token;

    // Create test wallet
    const walletResponse = await request(app)
      .post('/api/wallet/create')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        label: 'Load Test Wallet',
        mnemonic: 'test mnemonic phrase for testing purposes only',
      });
    
    walletId = walletResponse.body.data.walletId;
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 100 concurrent health checks', async () => {
      const concurrentRequests = 100;
      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() => request(app).get('/health/health'));

      const startTime = performance.now();
      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );

      expect(successfulResponses.length).toBe(concurrentRequests);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle 50 concurrent wallet balance requests', async () => {
      const concurrentRequests = 50;
      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() => 
          request(app)
            .get(`/api/wallet/balance/${walletId}`)
            .set('Authorization', `Bearer ${authToken}`)
        );

      const startTime = performance.now();
      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );

      expect(successfulResponses.length).toBe(concurrentRequests);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle 25 concurrent payment requests', async () => {
      const concurrentRequests = 25;
      const promises = Array(concurrentRequests)
        .fill(null)
        .map((_, index) => 
          request(app)
            .post('/api/wallet/payment/send')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              walletId,
              invoice: `lnbc${1000 + index}u1p3k2v5cpp5test${index}`,
            })
        );

      const startTime = performance.now();
      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );

      expect(successfulResponses.length).toBe(concurrentRequests);
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Memory Usage Under Load', () => {
    it('should maintain stable memory usage during sustained load', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 1000;
      const batchSize = 10;

      for (let i = 0; i < iterations; i += batchSize) {
        const promises = Array(batchSize)
          .fill(null)
          .map(() => 
            request(app)
              .get('/health/health')
          );

        await Promise.allSettled(promises);

        // Check memory every 100 iterations
        if (i % 100 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Memory increase should be reasonable (less than 100MB)
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
        }
      }
    });

    it('should handle large payloads without memory issues', async () => {
      const largeMemo = 'x'.repeat(100000); // 100KB memo
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const response = await request(app)
          .post('/api/wallet/invoice/new')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            walletId,
            amount: 1000,
            memo: largeMemo,
          });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Response Time Performance', () => {
    it('should maintain fast response times under load', async () => {
      const responseTimes: number[] = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const response = await request(app).get('/health/health');
        const endTime = performance.now();

        expect(response.status).toBe(200);
        responseTimes.push(endTime - startTime);
      }

      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

      expect(averageResponseTime).toBeLessThan(100); // Average under 100ms
      expect(maxResponseTime).toBeLessThan(1000); // Max under 1 second
      expect(p95ResponseTime).toBeLessThan(200); // 95th percentile under 200ms
    });

    it('should handle database connection pooling efficiently', async () => {
      const concurrentDbRequests = 50;
      const promises = Array(concurrentDbRequests)
        .fill(null)
        .map(() => 
          request(app)
            .get(`/api/wallet/balance/${walletId}`)
            .set('Authorization', `Bearer ${authToken}`)
        );

      const startTime = performance.now();
      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );

      expect(successfulResponses.length).toBe(concurrentDbRequests);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Handling Under Load', () => {
    it('should handle mixed success/failure scenarios gracefully', async () => {
      const mixedRequests = [
        { path: '/health/health', shouldSucceed: true },
        { path: '/api/wallet/balance/invalid-id', shouldSucceed: false },
        { path: '/health/health', shouldSucceed: true },
        { path: '/api/wallet/balance/invalid-id', shouldSucceed: false },
        { path: '/health/health', shouldSucceed: true },
      ];

      const promises = mixedRequests.map(({ path, shouldSucceed }) => 
        request(app).get(path).then(response => ({
          path,
          shouldSucceed,
          status: response.status,
          success: response.status === 200,
        }))
      );

      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { shouldSucceed, success } = result.value;
          expect(success).toBe(shouldSucceed);
        }
      });
    });

    it('should recover from temporary service failures', async () => {
      // Simulate temporary failures by making requests to non-existent endpoints
      const failureRequests = Array(20)
        .fill(null)
        .map(() => request(app).get('/api/non-existent-endpoint'));

      const successRequests = Array(20)
        .fill(null)
        .map(() => request(app).get('/health/health'));

      const [failureResults, successResults] = await Promise.all([
        Promise.allSettled(failureRequests),
        Promise.allSettled(successRequests),
      ]);

      // Failure requests should fail gracefully
      const failedRequests = failureResults.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 404
      );
      expect(failedRequests.length).toBe(20);

      // Success requests should still work
      const successfulRequests = successResults.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 200
      );
      expect(successfulRequests.length).toBe(20);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources after load tests', async () => {
      // Run a load test
      const promises = Array(50)
        .fill(null)
        .map(() => request(app).get('/health/health'));

      await Promise.allSettled(promises);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check that resources are cleaned up
      const finalMemory = process.memoryUsage();
      expect(finalMemory.heapUsed).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
    });
  });
});
