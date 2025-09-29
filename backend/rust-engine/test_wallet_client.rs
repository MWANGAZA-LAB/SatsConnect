use anyhow::Result;
use satsconnect_rust_engine::proto::satsconnect::wallet::v1::wallet_service_client::WalletServiceClient;
use satsconnect_rust_engine::proto::satsconnect::wallet::v1::{
    CreateWalletRequest, GetBalanceRequest, NewInvoiceRequest, SendPaymentRequest,
};

#[tokio::main]
async fn main() -> Result<()> {
    println!("🧪 Testing gRPC Wallet Service...");

    let mut wallet_client = WalletServiceClient::connect("http://127.0.0.1:50051").await?;
    println!("✅ Connected to gRPC wallet server");

    // Test CreateWallet
    let request = tonic::Request::new(CreateWalletRequest {
        label: "test_wallet".to_string(),
        mnemonic: "".to_string(), // Empty mnemonic will generate a new one
    });

    match wallet_client.create_wallet(request).await {
        Ok(response) => {
            let wallet = response.into_inner();
            println!("✅ CreateWallet successful:");
            println!("  Node ID: {}", wallet.node_id);
            println!("  Address: {}", wallet.address);
        }
        Err(e) => {
            println!("❌ CreateWallet failed: {}", e);
            return Ok(());
        }
    }

    // Test GetBalance
    let request = tonic::Request::new(GetBalanceRequest {});

    match wallet_client.get_balance(request).await {
        Ok(response) => {
            let balance = response.into_inner();
            println!("✅ GetBalance successful:");
            println!("  Confirmed: {} sats", balance.confirmed_sats);
            println!("  Lightning: {} sats", balance.lightning_sats);
        }
        Err(e) => {
            println!("❌ GetBalance failed: {}", e);
        }
    }

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

    println!("🎉 gRPC Wallet Service test completed!");
    Ok(())
}
