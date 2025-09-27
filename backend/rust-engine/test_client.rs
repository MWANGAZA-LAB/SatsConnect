use anyhow::Result;
use satsconnect_rust_engine::proto::satsconnect::wallet::v1::wallet_service_client::WalletServiceClient;
use satsconnect_rust_engine::proto::satsconnect::wallet::v1::{CreateWalletRequest, GetBalanceRequest};

#[tokio::main]
async fn main() -> Result<()> {
    println!("🧪 Testing gRPC client connection...");
    
    let mut client = WalletServiceClient::connect("http://127.0.0.1:50051").await?;
    println!("✅ Connected to gRPC server");

    // Test CreateWallet
    let request = tonic::Request::new(CreateWalletRequest {
        mnemonic: "".to_string(),
        label: "test-wallet".to_string(),
    });
    
    match client.create_wallet(request).await {
        Ok(response) => {
            let wallet = response.into_inner();
            println!("✅ CreateWallet successful:");
            println!("  Node ID: {}", wallet.node_id);
            println!("  Address: {}", wallet.address);
        }
        Err(e) => {
            println!("❌ CreateWallet failed: {}", e);
        }
    }

    // Test GetBalance
    let request = tonic::Request::new(GetBalanceRequest {});
    
    match client.get_balance(request).await {
        Ok(response) => {
            let balance = response.into_inner();
            println!("✅ GetBalance successful:");
            println!("  Confirmed sats: {}", balance.confirmed_sats);
            println!("  Lightning sats: {}", balance.lightning_sats);
        }
        Err(e) => {
            println!("❌ GetBalance failed: {}", e);
        }
    }

    println!("🎉 gRPC client test completed!");
    Ok(())
}
