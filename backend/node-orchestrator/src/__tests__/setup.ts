import { spawn, ChildProcess } from 'child_process';
import { createWalletClient, checkEngineHealth } from '../grpc';

// Global test setup
let rustEngineProcess: ChildProcess | null = null;

beforeAll(async () => {
  console.log('🚀 Starting Rust Engine for E2E tests...');
  
  // Start the Rust engine process
  rustEngineProcess = spawn('cargo', ['run'], {
    cwd: '../rust-engine',
    stdio: 'pipe',
    shell: true
  });

  // Wait for the engine to be ready
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      const isHealthy = await checkEngineHealth();
      if (isHealthy) {
        console.log('✅ Rust Engine is ready for testing');
        break;
      }
    } catch (error) {
      // Engine not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Rust Engine failed to start within 30 seconds');
  }
}, 60000); // 60 second timeout

afterAll(async () => {
  console.log('🛑 Stopping Rust Engine...');
  
  if (rustEngineProcess) {
    rustEngineProcess.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await new Promise(resolve => {
      if (rustEngineProcess) {
        rustEngineProcess.on('exit', resolve);
        setTimeout(resolve, 5000); // Force exit after 5 seconds
      } else {
        resolve(undefined);
      }
    });
  }
}, 10000); // 10 second timeout

// Global test utilities
export const testUtils = {
  async waitForEngine() {
    let attempts = 0;
    while (attempts < 10) {
      try {
        const isHealthy = await checkEngineHealth();
        if (isHealthy) return true;
      } catch (error) {
        // Continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    return false;
  },

  generateTestData() {
    return {
      wallet: {
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        label: 'test-wallet'
      },
      invoice: {
        amountSats: 1000,
        memo: 'Test payment'
      },
      payment: {
        paymentId: `test-pay-${Date.now()}`,
        walletId: `test-wallet-${Date.now()}`,
        amountSats: 1000,
        invoice: 'lnbc10u1p3k2v5cpp5...', // Mock invoice
        description: 'Test payment'
      }
    };
  }
};
