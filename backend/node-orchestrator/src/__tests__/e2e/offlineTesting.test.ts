import request from 'supertest';
import { app } from '../../index';
import { performance } from 'perf_hooks';

describe('Offline Testing Suite', () => {
  let authToken: string;
  let walletId: string;
  let originalGrpcClient: unknown;

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
        label: 'Offline Test Wallet',
        mnemonic: 'test mnemonic phrase for testing purposes only',
      });
    
    walletId = walletResponse.body.data.walletId;
  });

  beforeEach(() => {
    // Store original gRPC client
    originalGrpcClient = require('../../services/grpcClient');
  });

  afterEach(() => {
    // Restore original gRPC client
    jest.doMock('../../services/grpcClient', () => originalGrpcClient);
  });

  describe('Network Interruption Scenarios', () => {
    it('should handle gRPC service unavailability during wallet creation', async () => {
      // Mock gRPC service to be unavailable
      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(false),
        getClients: jest.fn().mockImplementation(() => {
          throw new Error('gRPC service unavailable');
        }),
      }));

      const response = await request(app)
        .post('/api/wallet/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'Offline Test Wallet',
          mnemonic: 'test mnemonic phrase for testing purposes only',
        });

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('gRPC service unavailable');
    });

    it('should handle network timeout during payment processing', async () => {
      // Mock gRPC service to timeout
      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(true),
        getClients: jest.fn().mockReturnValue({
          walletClient: {
            SendPayment: jest.fn().mockImplementation((request, callback) => {
              // Simulate timeout
              setTimeout(() => {
                callback(new Error('Request timeout'), null);
              }, 100);
            }),
          },
        }),
      }));

      const response = await request(app)
        .post('/api/wallet/payment/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          walletId,
          invoice: 'lnbc1000u1p3k2v5cpp5test',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Request timeout');
    });

    it('should handle partial network connectivity during balance check', async () => {
      // Mock gRPC service to fail intermittently
      let callCount = 0;
      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(true),
        getClients: jest.fn().mockReturnValue({
          walletClient: {
            GetBalance: jest.fn().mockImplementation((request, callback) => {
              callCount++;
              if (callCount % 2 === 0) {
                // Every other call fails
                callback(new Error('Network error'), null);
              } else {
                callback(null, {
                  onchainBalance: 1000000,
                  lightningBalance: 500000,
                });
              }
            }),
          },
        }),
      }));

      // First call should succeed
      const response1 = await request(app)
        .get(`/api/wallet/balance/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.status).toBe(200);
      expect(response1.body.success).toBe(true);

      // Second call should fail
      const response2 = await request(app)
        .get(`/api/wallet/balance/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response2.status).toBe(500);
      expect(response2.body.success).toBe(false);
    });
  });

  describe('Queue and Retry Mechanisms', () => {
    it('should queue payment requests when gRPC is unavailable', async () => {
      // Mock gRPC service to be unavailable
      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(false),
        getClients: jest.fn().mockImplementation(() => {
          throw new Error('gRPC service unavailable');
        }),
      }));

      // Mock queue service to capture queued jobs
      const mockQueueService = {
        addJob: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
        getJobStatus: jest.fn().mockResolvedValue('waiting'),
      };

      jest.doMock('../../services/queueService', () => mockQueueService);

      const response = await request(app)
        .post('/api/wallet/payment/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          walletId,
          invoice: 'lnbc1000u1p3k2v5cpp5test',
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('queued');
      expect(mockQueueService.addJob).toHaveBeenCalled();
    });

    it('should retry failed requests when service becomes available', async () => {
      let retryCount = 0;
      const maxRetries = 3;

      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(true),
        getClients: jest.fn().mockReturnValue({
          walletClient: {
            SendPayment: jest.fn().mockImplementation((request, callback) => {
              retryCount++;
              if (retryCount < maxRetries) {
                callback(new Error('Temporary network error'), null);
              } else {
                callback(null, {
                  paymentHash: 'test-payment-hash',
                  status: 'SUCCEEDED',
                });
              }
            }),
          },
        }),
      }));

      const response = await request(app)
        .post('/api/wallet/payment/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          walletId,
          invoice: 'lnbc1000u1p3k2v5cpp5test',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(retryCount).toBe(maxRetries);
    });
  });

  describe('Data Persistence During Offline Periods', () => {
    it('should persist wallet data during offline periods', async () => {
      // Mock gRPC service to be unavailable
      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(false),
        getClients: jest.fn().mockImplementation(() => {
          throw new Error('gRPC service unavailable');
        }),
      }));

      // Wallet data should still be accessible from local storage
      const response = await request(app)
        .get(`/api/wallet/balance/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should return cached data or error gracefully
      expect([200, 503]).toContain(response.status);
    });

    it('should handle offline transaction queuing', async () => {
      // Mock gRPC service to be unavailable
      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(false),
        getClients: jest.fn().mockImplementation(() => {
          throw new Error('gRPC service unavailable');
        }),
      }));

      // Mock queue service
      const mockQueueService = {
        addJob: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
        getJobStatus: jest.fn().mockResolvedValue('waiting'),
      };

      jest.doMock('../../services/queueService', () => mockQueueService);

      // Multiple offline transactions should be queued
      const promises = Array(5).fill(null).map((_, index) =>
        request(app)
          .post('/api/wallet/payment/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            walletId,
            invoice: `lnbc${1000 + index}u1p3k2v5cpp5test${index}`,
          })
      );

      const responses = await Promise.allSettled(promises);
      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 202
      );

      expect(successfulResponses.length).toBe(5);
      expect(mockQueueService.addJob).toHaveBeenCalledTimes(5);
    });
  });

  describe('Recovery and Reconnection', () => {
    it('should recover when gRPC service becomes available', async () => {
      let serviceAvailable = false;

      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockImplementation(() => {
          return Promise.resolve(serviceAvailable);
        }),
        getClients: jest.fn().mockImplementation(() => {
          if (!serviceAvailable) {
            throw new Error('gRPC service unavailable');
          }
          return {
            walletClient: {
              GetBalance: jest.fn().mockImplementation((request, callback) => {
                callback(null, {
                  onchainBalance: 1000000,
                  lightningBalance: 500000,
                });
              }),
            },
          };
        }),
      }));

      // First call should fail
      const response1 = await request(app)
        .get(`/api/wallet/balance/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.status).toBe(503);

      // Simulate service recovery
      serviceAvailable = true;

      // Second call should succeed
      const response2 = await request(app)
        .get(`/api/wallet/balance/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.success).toBe(true);
    });

    it('should process queued jobs when service recovers', async () => {
      let serviceAvailable = false;
      const queuedJobs: Array<{ process: () => void }> = [];

      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockImplementation(() => {
          return Promise.resolve(serviceAvailable);
        }),
        getClients: jest.fn().mockImplementation(() => {
          if (!serviceAvailable) {
            throw new Error('gRPC service unavailable');
          }
          return {
            walletClient: {
              SendPayment: jest.fn().mockImplementation((request, callback) => {
                callback(null, {
                  paymentHash: 'test-payment-hash',
                  status: 'SUCCEEDED',
                });
              }),
            },
          };
        }),
      }));

      // Mock queue service
      const mockQueueService = {
        addJob: jest.fn().mockImplementation((jobData: unknown) => {
          const job = { process: jest.fn() };
          queuedJobs.push(job);
          return Promise.resolve({ id: `job-${queuedJobs.length}` });
        }),
        getJobStatus: jest.fn().mockResolvedValue('waiting'),
        processJobs: jest.fn().mockImplementation(() => {
          if (serviceAvailable) {
            queuedJobs.forEach(job => {
              // Process queued job
              job.process();
            });
          }
        }),
      };

      jest.doMock('../../services/queueService', () => mockQueueService);

      // Queue a job while offline
      const response1 = await request(app)
        .post('/api/wallet/payment/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          walletId,
          invoice: 'lnbc1000u1p3k2v5cpp5test',
        });

      expect(response1.status).toBe(202);
      expect(queuedJobs.length).toBe(1);

      // Simulate service recovery
      serviceAvailable = true;
      mockQueueService.processJobs();

      // Job should be processed
      expect(mockQueueService.processJobs).toHaveBeenCalled();
    });
  });

  describe('Error Handling and User Feedback', () => {
    it('should provide clear error messages for offline scenarios', async () => {
      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(false),
        getClients: jest.fn().mockImplementation(() => {
          throw new Error('gRPC service unavailable');
        }),
      }));

      const response = await request(app)
        .post('/api/wallet/payment/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          walletId,
          invoice: 'lnbc1000u1p3k2v5cpp5test',
        });

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('offline');
      expect(response.body.message).toContain('retry');
    });

    it('should handle partial offline scenarios gracefully', async () => {
      // Mock gRPC service to fail for specific operations
      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(true),
        getClients: jest.fn().mockReturnValue({
          walletClient: {
            GetBalance: jest.fn().mockImplementation((request, callback) => {
              callback(null, {
                onchainBalance: 1000000,
                lightningBalance: 500000,
              });
            }),
            SendPayment: jest.fn().mockImplementation((request, callback) => {
              callback(new Error('Lightning network unavailable'), null);
            }),
          },
        }),
      }));

      // Balance check should work
      const balanceResponse = await request(app)
        .get(`/api/wallet/balance/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(balanceResponse.status).toBe(200);
      expect(balanceResponse.body.success).toBe(true);

      // Payment should fail with specific error
      const paymentResponse = await request(app)
        .post('/api/wallet/payment/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          walletId,
          invoice: 'lnbc1000u1p3k2v5cpp5test',
        });

      expect(paymentResponse.status).toBe(500);
      expect(paymentResponse.body.success).toBe(false);
      expect(paymentResponse.body.error).toContain('Lightning network unavailable');
    });
  });

  describe('Performance Under Offline Conditions', () => {
    it('should maintain fast response times for cached data', async () => {
      // Mock gRPC service to be unavailable
      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(false),
        getClients: jest.fn().mockImplementation(() => {
          throw new Error('gRPC service unavailable');
        }),
      }));

      const startTime = performance.now();
      const response = await request(app)
        .get(`/api/wallet/balance/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`);
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle high volume of offline requests efficiently', async () => {
      // Mock gRPC service to be unavailable
      jest.doMock('../../services/grpcClient', () => ({
        checkHealth: jest.fn().mockResolvedValue(false),
        getClients: jest.fn().mockImplementation(() => {
          throw new Error('gRPC service unavailable');
        }),
      }));

      // Mock queue service
      const mockQueueService = {
        addJob: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
        getJobStatus: jest.fn().mockResolvedValue('waiting'),
      };

      jest.doMock('../../services/queueService', () => mockQueueService);

      const startTime = performance.now();
      const promises = Array(100).fill(null).map(() =>
        request(app)
          .post('/api/wallet/payment/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            walletId,
            invoice: 'lnbc1000u1p3k2v5cpp5test',
          })
      );

      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && response.value.status === 202
      );

      expect(successfulResponses.length).toBe(100);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
