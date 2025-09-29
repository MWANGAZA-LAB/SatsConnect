import grpcClientService from './grpcClient';
import logger from '../utils/logger';

export interface ProcessPaymentRequest {
  payment_id?: string;
  wallet_id: string;
  amount_sats: number;
  invoice: string;
  description?: string;
}

export interface ProcessPaymentResponse {
  success: boolean;
  data?: {
    payment_id: string;
    status: string;
    message: string;
    amount_sats: number;
    payment_hash: string;
    timestamp: string;
  };
  error?: string;
}

export interface GetPaymentStatusRequest {
  payment_id: string;
}

export interface GetPaymentStatusResponse {
  success: boolean;
  data?: {
    payment_id: string;
    status: string;
    message: string;
    amount_sats: number;
    payment_hash: string;
    timestamp: string;
  };
  error?: string;
}

export interface RefundPaymentRequest {
  payment_id: string;
  amount_sats: number;
}

export interface RefundPaymentResponse {
  success: boolean;
  data?: {
    payment_id: string;
    status: string;
    message: string;
    amount_sats: number;
    payment_hash: string;
    timestamp: string;
  };
  error?: string;
}

class PaymentService {
  private async callGrpcMethod<T>(
    method: string,
    request: unknown,
    clientMethod: (request: unknown, callback: (error: unknown, response: unknown) => void) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`gRPC call timeout: ${method}`));
      }, 10000); // 10 second timeout

      clientMethod.call(this, request, (error: unknown, response: unknown) => {
        clearTimeout(timeout);

        if (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown gRPC error';
          const errorCode = (error as { code?: number })?.code;
          const errorDetails = (error as { details?: string })?.details;
          
          logger.error(`gRPC call failed: ${method}`, {
            error: errorMessage,
            code: errorCode,
            details: errorDetails,
          });
          reject(new Error(`gRPC call failed: ${errorMessage}`));
        } else {
          logger.debug(`gRPC call successful: ${method}`, { response });
          resolve(response as T);
        }
      });
    });
  }

  public async processPayment(request: ProcessPaymentRequest): Promise<ProcessPaymentResponse> {
    try {
      const clients = grpcClientService.getClients();

      const grpcRequest = {
        payment_id: request.payment_id || '',
        wallet_id: request.wallet_id,
        amount_sats: request.amount_sats,
        invoice: request.invoice,
        description: request.description || '',
      };

      const response = await this.callGrpcMethod(
        'ProcessPayment',
        grpcRequest,
        clients.paymentClient.ProcessPayment.bind(clients.paymentClient)
      );

      return {
        success: true,
        data: {
          payment_id: (response as { payment_id?: string }).payment_id,
          status: (response as { status?: string }).status,
          message: (response as { message?: string }).message,
          amount_sats: (response as { amount_sats?: number }).amount_sats,
          payment_hash: (response as { payment_hash?: string }).payment_hash,
          timestamp: (response as { timestamp?: string }).timestamp,
        },
      };
    } catch (error) {
      logger.error('ProcessPayment failed', { error: error.message, request });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  public async getPaymentStatus(
    request: GetPaymentStatusRequest
  ): Promise<GetPaymentStatusResponse> {
    try {
      const clients = grpcClientService.getClients();

      const grpcRequest = {
        payment_id: request.payment_id,
      };

      const response = await this.callGrpcMethod(
        'GetPaymentStatus',
        grpcRequest,
        clients.paymentClient.GetPaymentStatus.bind(clients.paymentClient)
      );

      return {
        success: true,
        data: {
          payment_id: (response as { payment_id?: string }).payment_id,
          status: (response as { status?: string }).status,
          message: (response as { message?: string }).message,
          amount_sats: (response as { amount_sats?: number }).amount_sats,
          payment_hash: (response as { payment_hash?: string }).payment_hash,
          timestamp: (response as { timestamp?: string }).timestamp,
        },
      };
    } catch (error) {
      logger.error('GetPaymentStatus failed', { error: error.message, request });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  public async refundPayment(request: RefundPaymentRequest): Promise<RefundPaymentResponse> {
    try {
      const clients = grpcClientService.getClients();

      const grpcRequest = {
        payment_id: request.payment_id,
        amount_sats: request.amount_sats,
      };

      const response = await this.callGrpcMethod(
        'ProcessRefund',
        grpcRequest,
        clients.paymentClient.ProcessRefund.bind(clients.paymentClient)
      );

      return {
        success: true,
        data: {
          payment_id: (response as { payment_id?: string }).payment_id,
          status: (response as { status?: string }).status,
          message: (response as { message?: string }).message,
          amount_sats: (response as { amount_sats?: number }).amount_sats,
          payment_hash: (response as { payment_hash?: string }).payment_hash,
          timestamp: (response as { timestamp?: string }).timestamp,
        },
      };
    } catch (error) {
      logger.error('RefundPayment failed', { error: error.message, request });
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const paymentService = new PaymentService();
export default paymentService;
