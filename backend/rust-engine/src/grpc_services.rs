use anyhow::Result;
use satsconnect_rust_engine::proto::satsconnect::payment::v1::{
    payment_service_server::PaymentService, PaymentRequest, PaymentResponse, PaymentStatusRequest,
    PaymentStreamRequest, PaymentStreamResponse, RefundRequest,
};
use satsconnect_rust_engine::proto::satsconnect::wallet::v1::{
    wallet_service_server::WalletService, CreateWalletRequest, CreateWalletResponse,
    GetBalanceRequest, GetBalanceResponse, NewInvoiceRequest, NewInvoiceResponse,
    SendPaymentRequest, SendPaymentResponse,
};
use satsconnect_rust_engine::{payment::PaymentHandler, wallet::WalletHandler};
use std::sync::Arc;
use tonic::{Request, Response, Status};

pub struct WalletServiceImpl {
    wallet_handler: Arc<WalletHandler>,
}

impl WalletServiceImpl {
    pub fn new(wallet_handler: Arc<WalletHandler>) -> Self {
        Self { wallet_handler }
    }
}

#[tonic::async_trait]
impl WalletService for WalletServiceImpl {
    async fn create_wallet(
        &self,
        request: Request<CreateWalletRequest>,
    ) -> Result<Response<CreateWalletResponse>, Status> {
        let req = request.into_inner();

        let label = if req.label.is_empty() {
            "default".to_string()
        } else {
            req.label
        };
        let mnemonic = if req.mnemonic.is_empty() {
            None
        } else {
            Some(req.mnemonic)
        };

        match self.wallet_handler.create_wallet(label, mnemonic).await {
            Ok((node_id, address)) => {
                let response = CreateWalletResponse { node_id, address };
                Ok(Response::new(response))
            }
            Err(e) => Err(Status::internal(e.to_string())),
        }
    }

    async fn get_balance(
        &self,
        _request: Request<GetBalanceRequest>,
    ) -> Result<Response<GetBalanceResponse>, Status> {
        match self.wallet_handler.get_balance().await {
            Ok((confirmed_sats, lightning_sats)) => {
                let response = GetBalanceResponse {
                    confirmed_sats,
                    lightning_sats,
                };
                Ok(Response::new(response))
            }
            Err(e) => Err(Status::internal(e.to_string())),
        }
    }

    async fn new_invoice(
        &self,
        request: Request<NewInvoiceRequest>,
    ) -> Result<Response<NewInvoiceResponse>, Status> {
        let req = request.into_inner();

        match self
            .wallet_handler
            .generate_invoice(req.amount_sats, req.memo)
            .await
        {
            Ok((invoice, payment_hash)) => {
                let response = NewInvoiceResponse {
                    invoice,
                    payment_hash,
                };
                Ok(Response::new(response))
            }
            Err(e) => Err(Status::internal(e.to_string())),
        }
    }

    async fn send_payment(
        &self,
        request: Request<SendPaymentRequest>,
    ) -> Result<Response<SendPaymentResponse>, Status> {
        let req = request.into_inner();

        match self.wallet_handler.send_payment(req.invoice).await {
            Ok((payment_hash, status)) => {
                let response = SendPaymentResponse {
                    payment_hash,
                    status,
                };
                Ok(Response::new(response))
            }
            Err(e) => Err(Status::internal(e.to_string())),
        }
    }
}

pub struct PaymentServiceImpl {
    payment_handler: Arc<PaymentHandler>,
}

impl PaymentServiceImpl {
    pub fn new(payment_handler: Arc<PaymentHandler>) -> Self {
        Self { payment_handler }
    }
}

#[tonic::async_trait]
impl PaymentService for PaymentServiceImpl {
    async fn process_payment(
        &self,
        request: Request<PaymentRequest>,
    ) -> Result<Response<PaymentResponse>, Status> {
        let req = request.into_inner();

        match self
            .payment_handler
            .process_payment(
                Some(req.payment_id),
                req.wallet_id,
                req.amount_sats,
                req.invoice,
                req.description,
            )
            .await
        {
            Ok(payment) => {
                let response = PaymentResponse {
                    payment_id: payment.payment_id,
                    status: payment.status,
                    message: payment.description,
                    amount_sats: payment.amount_sats,
                    payment_hash: payment.payment_hash,
                    timestamp: payment.timestamp,
                };
                Ok(Response::new(response))
            }
            Err(e) => Err(Status::internal(e.to_string())),
        }
    }

    async fn get_payment_status(
        &self,
        request: Request<PaymentStatusRequest>,
    ) -> Result<Response<PaymentResponse>, Status> {
        let req = request.into_inner();

        match self
            .payment_handler
            .get_payment_status(req.payment_id)
            .await
        {
            Ok(payment) => {
                let response = PaymentResponse {
                    payment_id: payment.payment_id,
                    status: payment.status,
                    message: payment.description,
                    amount_sats: payment.amount_sats,
                    payment_hash: payment.payment_hash,
                    timestamp: payment.timestamp,
                };
                Ok(Response::new(response))
            }
            Err(e) => Err(Status::internal(e.to_string())),
        }
    }

    async fn process_refund(
        &self,
        request: Request<RefundRequest>,
    ) -> Result<Response<PaymentResponse>, Status> {
        let req = request.into_inner();

        match self
            .payment_handler
            .process_refund(req.payment_id, req.amount_sats)
            .await
        {
            Ok(payment) => {
                let response = PaymentResponse {
                    payment_id: payment.payment_id,
                    status: payment.status,
                    message: payment.description,
                    amount_sats: payment.amount_sats,
                    payment_hash: payment.payment_hash,
                    timestamp: payment.timestamp,
                };
                Ok(Response::new(response))
            }
            Err(e) => Err(Status::internal(e.to_string())),
        }
    }

    type PaymentStreamStream = std::pin::Pin<
        Box<dyn futures::Stream<Item = Result<PaymentStreamResponse, Status>> + Send>,
    >;

    async fn payment_stream(
        &self,
        _request: Request<PaymentStreamRequest>,
    ) -> Result<Response<Self::PaymentStreamStream>, Status> {
        // For now, return an empty stream
        // In a real implementation, this would stream payment updates
        let stream = futures::stream::empty::<Result<PaymentStreamResponse, Status>>();
        Ok(Response::new(Box::pin(stream)))
    }
}
