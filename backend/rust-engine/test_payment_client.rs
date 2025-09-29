use anyhow::Result;
use satsconnect_rust_engine::proto::satsconnect::payment::v1::payment_service_client::PaymentServiceClient;
use satsconnect_rust_engine::proto::satsconnect::payment::v1::PaymentRequest;
use satsconnect_rust_engine::proto::satsconnect::wallet::v1::wallet_service_client::WalletServiceClient;
use satsconnect_rust_engine::proto::satsconnect::wallet::v1::{
    NewInvoiceRequest, SendPaymentRequest,
};

#[tokio::main]
async fn main() -> Result<()> {
    println!("🧪 Testing gRPC Payment Service...");

    let mut wallet_client = WalletServiceClient::connect("http://127.0.0.1:50051").await?;
    let mut payment_client = PaymentServiceClient::connect("http://127.0.0.1:50051").await?;
    println!("✅ Connected to gRPC servers");

    // Test NewInvoice
    let request = tonic::Request::new(NewInvoiceRequest {
        amount_sats: 1000,
        memo: "Test invoice".to_string(),
    });

    match wallet_client.new_invoice(request).await {
        Ok(response) => {
            let invoice = response.into_inner();
            println!("✅ NewInvoice successful:");
            println!("  Invoice: {}", invoice.invoice);
            println!("  Payment Hash: {}", invoice.payment_hash);

            // Test SendPayment
            let request = tonic::Request::new(SendPaymentRequest {
                invoice: invoice.invoice.clone(),
            });

            match wallet_client.send_payment(request).await {
                Ok(response) => {
                    let payment = response.into_inner();
                    println!("✅ SendPayment successful:");
                    println!("  Payment Hash: {}", payment.payment_hash);
                    println!("  Status: {}", payment.status);
                }
                Err(e) => {
                    println!("❌ SendPayment failed: {}", e);
                }
            }
        }
        Err(e) => {
            println!("❌ NewInvoice failed: {}", e);
        }
    }

    // Test PaymentService
    let request = tonic::Request::new(PaymentRequest {
        payment_id: "test_payment_123".to_string(),
        wallet_id: "test_wallet".to_string(),
        amount_sats: 500,
        invoice: "lnbc500u1p3k2v5cpp5test".to_string(),
        description: "Test payment".to_string(),
    });

    match payment_client.process_payment(request).await {
        Ok(response) => {
            let payment = response.into_inner();
            println!("✅ ProcessPayment successful:");
            println!("  Payment ID: {}", payment.payment_id);
            println!("  Status: {}", payment.status);
            println!("  Amount: {} sats", payment.amount_sats);
        }
        Err(e) => {
            println!("❌ ProcessPayment failed: {}", e);
        }
    }

    println!("🎉 gRPC Payment Service test completed!");
    Ok(())
}
