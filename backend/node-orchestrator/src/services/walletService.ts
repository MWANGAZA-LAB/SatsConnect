import grpcClientService from './grpcClient';
import logger from '../utils/logger';

export interface CreateWalletRequest {
  label?: string;
  mnemonic?: string;
}

export interface CreateWalletResponse {
  success: boolean;
  data?: {
    node_id: string;
    address: string;
  };
  error?: string;
}

export interface GetBalanceResponse {
  success: boolean;
  data?: {
    confirmed_sats: number;
    lightning_sats: number;
  };
  error?: string;
}

export interface NewInvoiceRequest {
  amount_sats: number;
  memo?: string;
}

export interface NewInvoiceResponse {
  success: boolean;
  data?: {
    invoice: string;
    payment_hash: string;
  };
  error?: string;
}

export interface SendPaymentRequest {
  invoice: string;
}

export interface SendPaymentResponse {
  success: boolean;
  data?: {
    payment_hash: string;
    status: string;
  };
  error?: string;
}

export interface BuyAirtimeRequest {
  amount_sats: number;
  phone_number: string;
  provider?: string;
}

export interface BuyAirtimeResponse {
  success: boolean;
  data?: {
    invoice: string;
    payment_hash: string;
    status: string;
  };
  error?: string;
}

class WalletService {
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

  public async createWallet(request: CreateWalletRequest): Promise<CreateWalletResponse> {
    try {
      const clients = grpcClientService.getClients();

      const grpcRequest = {
        label: request.label || 'default',
        mnemonic: request.mnemonic || '',
      };

      const response = await this.callGrpcMethod(
        'CreateWallet',
        grpcRequest,
        clients.walletClient.CreateWallet.bind(clients.walletClient)
      );

      return {
        success: true,
        data: {
          node_id: (response as { node_id?: string }).node_id,
          address: (response as { address?: string }).address,
        },
      };
    } catch (error) {
      logger.error('CreateWallet failed', { error: error.message, request });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  public async getBalance(): Promise<GetBalanceResponse> {
    try {
      const clients = grpcClientService.getClients();

      const response = await this.callGrpcMethod(
        'GetBalance',
        {},
        clients.walletClient.GetBalance.bind(clients.walletClient)
      );

      return {
        success: true,
        data: {
          confirmed_sats: (response as { confirmed_sats?: number }).confirmed_sats,
          lightning_sats: (response as { lightning_sats?: number }).lightning_sats,
        },
      };
    } catch (error) {
      logger.error('GetBalance failed', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  public async newInvoice(request: NewInvoiceRequest): Promise<NewInvoiceResponse> {
    try {
      const clients = grpcClientService.getClients();

      const grpcRequest = {
        amount_sats: request.amount_sats,
        memo: request.memo || '',
      };

      const response = await this.callGrpcMethod(
        'NewInvoice',
        grpcRequest,
        clients.walletClient.NewInvoice.bind(clients.walletClient)
      );

      return {
        success: true,
        data: {
          invoice: (response as { invoice?: string }).invoice,
          payment_hash: (response as { payment_hash?: string }).payment_hash,
        },
      };
    } catch (error) {
      logger.error('NewInvoice failed', { error: error.message, request });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  public async sendPayment(request: SendPaymentRequest): Promise<SendPaymentResponse> {
    try {
      const clients = grpcClientService.getClients();

      const grpcRequest = {
        invoice: request.invoice,
      };

      const response = await this.callGrpcMethod(
        'SendPayment',
        grpcRequest,
        clients.walletClient.SendPayment.bind(clients.walletClient)
      );

      return {
        success: true,
        data: {
          payment_hash: (response as { payment_hash?: string }).payment_hash,
          status: (response as { status?: string }).status,
        },
      };
    } catch (error) {
      logger.error('SendPayment failed', { error: error.message, request });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  public async buyAirtime(request: BuyAirtimeRequest): Promise<BuyAirtimeResponse> {
    try {
      const clients = grpcClientService.getClients();

      const grpcRequest = {
        amount_sats: request.amount_sats,
        phone_number: request.phone_number,
        provider: request.provider || '',
      };

      const response = await this.callGrpcMethod(
        'BuyAirtime',
        grpcRequest,
        clients.walletClient.BuyAirtime.bind(clients.walletClient)
      );

      return {
        success: true,
        data: {
          invoice: (response as { invoice?: string }).invoice,
          payment_hash: (response as { payment_hash?: string }).payment_hash,
          status: (response as { status?: string }).status,
        },
      };
    } catch (error) {
      logger.error('BuyAirtime failed', { error: error.message, request });
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const walletService = new WalletService();
export default walletService;
