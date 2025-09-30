export interface WalletData {
  nodeId: string;
  address: string;
  label: string;
  createdAt: string;
}

export interface TransactionData {
  id: string;
  type: 'send' | 'receive';
  amount: number;
  description: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface InvoiceData {
  invoice: string;
  paymentHash: string;
  amount: number;
  description: string;
  expiresAt: number;
}
