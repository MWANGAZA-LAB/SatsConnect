// Mock gRPC clients for testing when Rust engine is not available

export const mockWalletClient = {
  createWallet: (request: any, callback: (error: any, response: any) => void) => {
    setTimeout(() => {
      if (request.mnemonic && request.mnemonic.split(' ').length < 12) {
        callback({ code: 3, message: 'Invalid mnemonic' }, null);
      } else {
        callback(null, {
          nodeId: 'mock-node-id-' + Date.now(),
          address: 'tb1qmock' + Math.random().toString(36).substring(7),
        });
      }
    }, 100);
  },

  getBalance: (request: any, callback: (error: any, response: any) => void) => {
    setTimeout(() => {
      callback(null, {
        confirmedSats: '1000000',
        lightningSats: '500000',
      });
    }, 100);
  },

  newInvoice: (request: any, callback: (error: any, response: any) => void) => {
    setTimeout(() => {
      if (request.amountSats < 0) {
        callback({ code: 3, message: 'Invalid amount' }, null);
      } else {
        callback(null, {
          invoice: 'lnbc' + request.amountSats + 'u1p3k2v5cpp5' + Math.random().toString(36),
          paymentHash: 'mock-payment-hash-' + Date.now(),
          amountSats: request.amountSats,
        });
      }
    }, 100);
  },

  sendPayment: (request: any, callback: (error: any, response: any) => void) => {
    setTimeout(() => {
      if (!request.invoice || request.invoice.length < 10) {
        callback({ code: 3, message: 'Invalid invoice' }, null);
      } else {
        callback(null, {
          paymentHash: 'mock-payment-hash-' + Date.now(),
          status: 'SUCCEEDED',
        });
      }
    }, 100);
  },

  buyAirtime: (request: any, callback: (error: any, response: any) => void) => {
    setTimeout(() => {
      callback(null, {
        invoice: 'lnbc' + request.amountSats + 'u1p3k2v5cpp5' + Math.random().toString(36),
        paymentHash: 'mock-airtime-hash-' + Date.now(),
        amountSats: request.amountSats,
        phoneNumber: request.phoneNumber,
        provider: request.provider || 'MTN',
      });
    }, 100);
  },
};

export const mockPaymentClient = {
  processPayment: (request: any, callback: (error: any, response: any) => void) => {
    setTimeout(() => {
      if (!request.paymentId || request.paymentId.length === 0) {
        callback({ code: 3, message: 'Invalid payment ID' }, null);
      } else {
        callback(null, {
          paymentId: request.paymentId,
          status: 'COMPLETED',
          amountSats: request.amountSats,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }, 100);
  },

  getPaymentStatus: (request: any, callback: (error: any, response: any) => void) => {
    setTimeout(() => {
      callback(null, {
        paymentId: request.paymentId,
        status: 'COMPLETED',
        message: 'Payment processed successfully',
        amountSats: '1000',
        paymentHash: 'mock-hash-' + Date.now(),
        timestamp: new Date().toISOString(),
      });
    }, 100);
  },

  processRefund: (request: any, callback: (error: any, response: any) => void) => {
    setTimeout(() => {
      callback(null, {
        paymentId: request.paymentId,
        status: 'REFUNDED',
        refundAmountSats: request.amountSats,
        updatedAt: new Date().toISOString(),
      });
    }, 100);
  },

  streamPayments: (request: any) => {
    // Mock stream - returns a simple object with mock data
    return {
      on: (event: string, handler: (data: any) => void) => {
        if (event === 'data') {
          setTimeout(() => {
            handler({
              payments: [
                {
                  paymentId: 'mock-payment-1',
                  status: 'COMPLETED',
                  amountSats: '1000',
                  paymentHash: 'mock-hash-1',
                  timestamp: new Date().toISOString(),
                },
                {
                  paymentId: 'mock-payment-2',
                  status: 'PENDING',
                  amountSats: '2000',
                  paymentHash: 'mock-hash-2',
                  timestamp: new Date().toISOString(),
                },
              ],
              count: 2,
            });
          }, 100);
        }
        if (event === 'end') {
          setTimeout(() => handler({}), 200);
        }
      },
    };
  },
};

export function createMockWalletClient() {
  return mockWalletClient;
}

export function createMockPaymentClient() {
  return mockPaymentClient;
}

export function handleMockGrpcError(error: any): {
  success: boolean;
  error?: string;
  code?: number;
} {
  if (!error) {
    return { success: true };
  }

  const grpcError = error as { code?: number; message?: string; details?: string };

  return {
    success: false,
    error: grpcError.message || grpcError.details || 'Unknown gRPC error',
    code: grpcError.code || 2, // Unknown status
  };
}
