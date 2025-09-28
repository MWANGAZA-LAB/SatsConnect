import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import config from '../config/index';
import logger from '../utils/logger';

// Load proto files
const PROTO_PATH = join(process.cwd(), 'proto');
const packageDefinition = protoLoader.loadSync(
  [join(PROTO_PATH, 'wallet.proto'), join(PROTO_PATH, 'payment.proto')],
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);

const protoDefinition = grpc.loadPackageDefinition(packageDefinition) as any;
const walletProto = protoDefinition.satsconnect.wallet.v1;
const paymentProto = protoDefinition.satsconnect.payment.v1;

export interface GrpcClients {
  walletClient: any;
  paymentClient: any;
}

class GrpcClientService {
  private clients: GrpcClients | null = null;
  private isConnected = false;

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    try {
      const grpcOptions = {
        'grpc.keepalive_time_ms': 30000,
        'grpc.keepalive_timeout_ms': 5000,
        'grpc.keepalive_permit_without_calls': true,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': 10000,
        'grpc.http2.min_ping_interval_without_data_ms': 300000,
      };

      const credentials = config.rustEngine.useTls
        ? grpc.credentials.createSsl()
        : grpc.credentials.createInsecure();

      this.clients = {
        walletClient: new walletProto.WalletService(
          config.rustEngine.grpcUrl,
          credentials,
          grpcOptions
        ),
        paymentClient: new paymentProto.PaymentService(
          config.rustEngine.grpcUrl,
          credentials,
          grpcOptions
        ),
      };

      this.isConnected = true;
      logger.info('gRPC clients initialized successfully', {
        url: config.rustEngine.grpcUrl,
        useTls: config.rustEngine.useTls,
      });
    } catch (error) {
      logger.error('Failed to initialize gRPC clients', { error: error.message });
      this.isConnected = false;
    }
  }

  public getClients(): GrpcClients {
    if (!this.clients || !this.isConnected) {
      throw new Error('gRPC clients not initialized or not connected');
    }
    return this.clients;
  }

  public isHealthy(): boolean {
    return this.isConnected && this.clients !== null;
  }

  public async checkHealth(): Promise<boolean> {
    try {
      if (!this.clients) {
        return false;
      }

      // Try to call a simple method to check if the service is responsive
      return new Promise((resolve) => {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 5); // 5 second timeout

        this.clients!.walletClient.GetBalance({}, { deadline }, (error: any) => {
          if (error) {
            logger.warn('gRPC health check failed', { error: error.message });
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      logger.error('gRPC health check error', { error: error.message });
      return false;
    }
  }

  public reconnect(): void {
    logger.info('Attempting to reconnect gRPC clients...');
    this.isConnected = false;
    this.clients = null;
    this.initializeClients();
  }
}

// Export singleton instance
export const grpcClientService = new GrpcClientService();
export default grpcClientService;
