import request from 'supertest';
import { app } from '../../index';
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';

describe('Stress Testing Suite', () => {
  let authToken: string;
  let walletId: string;
  let server: { close: () => void } | null = null;

  beforeAll(async () => {
    // Start server for stress testing
    server = app.listen(0);
    
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
        label: 'Stress Test Wallet',
        mnemonic: 'test mnemonic phrase for testing purposes only',
      });
    
    walletId = walletResponse.body.data.walletId;
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('High Volume Request Handling', () => {
    it('should handle 1000 concurrent health checks', async () => {
      const concurrentRequests = 1000;
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
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle 500 concurrent wallet operations', async () => {
      const concurrentRequests = 500;
      const promises = Array(concurrentRequests)
        .fill(null)
        .map((_, index) => 
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
      expect(endTime - startTime).toBeLessThan(60000); // Should complete within 60 seconds
    });

    it('should handle 100 concurrent payment requests', async () => {
      const concurrentRequests = 100;
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
      expect(endTime - startTime).toBeLessThan(120000); // Should complete within 2 minutes
    });
  });

  describe('Memory Stress Testing', () => {
    it('should maintain stable memory usage under sustained load', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 10000;
      const batchSize = 100;

      for (let i = 0; i < iterations; i += batchSize) {
        const promises = Array(batchSize)
          .fill(null)
          .map(() => 
            request(app)
              .get('/health/health')
          );

        await Promise.allSettled(promises);

        // Check memory every 1000 iterations
        if (i % 1000 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Memory increase should be reasonable (less than 500MB)
          expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
        }
      }
    });

    it('should handle memory leaks in long-running processes', async () => {
      const initialMemory = process.memoryUsage();
      const duration = 60000; // 1 minute
      const startTime = Date.now();

      while (Date.now() - startTime < duration) {
        const promises = Array(50)
          .fill(null)
          .map(() => 
            request(app)
              .get('/health/health')
          );

        await Promise.allSettled(promises);

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable after 1 minute
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
    });
  });

  describe('CPU Stress Testing', () => {
    it('should handle CPU-intensive operations under load', async () => {
      const cpuIntensiveRequests = 100;
      const promises = Array(cpuIntensiveRequests)
        .fill(null)
        .map(() => 
          request(app)
            .post('/api/wallet/invoice/new')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              walletId,
              amount: 1000,
              memo: 'CPU stress test invoice',
            })
        );

      const startTime = performance.now();
      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );

      expect(successfulResponses.length).toBe(cpuIntensiveRequests);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should maintain response times under CPU load', async () => {
      const responseTimes: number[] = [];
      const iterations = 1000;

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

      expect(averageResponseTime).toBeLessThan(200); // Average under 200ms
      expect(maxResponseTime).toBeLessThan(2000); // Max under 2 seconds
      expect(p95ResponseTime).toBeLessThan(500); // 95th percentile under 500ms
    });
  });

  describe('Database Stress Testing', () => {
    it('should handle high database concurrency', async () => {
      const dbRequests = 200;
      const promises = Array(dbRequests)
        .fill(null)
        .map((_, index) => 
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

      expect(successfulResponses.length).toBe(dbRequests);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle database connection pooling under load', async () => {
      const connectionTests = 500;
      const promises = Array(connectionTests)
        .fill(null)
        .map(() => 
          request(app)
            .get('/health/health')
        );

      const startTime = performance.now();
      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );

      expect(successfulResponses.length).toBe(connectionTests);
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Network Stress Testing', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutRequests = 100;
      const promises = Array(timeoutRequests)
        .fill(null)
        .map(() => 
          request(app)
            .get('/health/health')
            .timeout(1000) // 1 second timeout
        );

      const responses = await Promise.allSettled(promises);
      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );

      expect(successfulResponses.length).toBe(timeoutRequests);
    });

    it('should handle slow network conditions', async () => {
      const slowRequests = 50;
      const promises = Array(slowRequests)
        .fill(null)
        .map(() => 
          request(app)
            .get('/health/health')
        );

      const startTime = performance.now();
      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );

      expect(successfulResponses.length).toBe(slowRequests);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Error Recovery Under Load', () => {
    it('should recover from temporary failures under load', async () => {
      const mixedRequests = 200;
      const promises = Array(mixedRequests)
        .fill(null)
        .map((_, index) => {
          if (index % 10 === 0) {
            // Every 10th request to a non-existent endpoint
            return request(app).get('/api/non-existent-endpoint');
          } else {
            // Regular health check
            return request(app).get('/health/health');
          }
        });

      const responses = await Promise.allSettled(promises);
      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );
      const failedResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 404
      );

      expect(successfulResponses.length).toBeGreaterThan(150);
      expect(failedResponses.length).toBeGreaterThan(10);
    });

    it('should maintain service availability during partial failures', async () => {
      const availabilityRequests = 1000;
      const promises = Array(availabilityRequests)
        .fill(null)
        .map(() => request(app).get('/health/health'));

      const responses = await Promise.allSettled(promises);
      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 200
      );

      // Should maintain at least 95% availability
      expect(successfulResponses.length / availabilityRequests).toBeGreaterThan(0.95);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources after stress tests', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run stress test
      const promises = Array(1000)
        .fill(null)
        .map(() => request(app).get('/health/health'));

      await Promise.allSettled(promises);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be minimal after cleanup
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });
});
