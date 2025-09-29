use anyhow::Result;
use satsconnect_rust_engine::{wallet::WalletHandler, payment::PaymentHandler};
use satsconnect_rust_engine::proto::satsconnect::wallet::v1::wallet_service_server::WalletServiceServer;
use satsconnect_rust_engine::proto::satsconnect::payment::v1::payment_service_server::PaymentServiceServer;
use std::sync::Arc;
use tonic::transport::Server;

mod grpc_services;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let wallet_handler = Arc::new(WalletHandler::new()?);
    let payment_handler = Arc::new(PaymentHandler::new());

    println!("🚀 SatsConnect Rust Engine starting...");
    println!("📊 Mock Lightning Engine initialized");

    // Create gRPC services
    let wallet_service = WalletServiceServer::new(grpc_services::WalletServiceImpl::new(wallet_handler));
    let payment_service = PaymentServiceServer::new(grpc_services::PaymentServiceImpl::new(payment_handler));

    println!("🔗 gRPC Services:");
    println!("  WalletService - CreateWallet, GetBalance");
    println!("  PaymentService - NewInvoice, SendPayment, BuyAirtime");
    println!("🌐 gRPC Server starting on http://127.0.0.1:50051");

    let addr = "127.0.0.1:50051".parse()?;
    println!("🌐 Starting gRPC server on {}", addr);
    
    let server = Server::builder()
        .add_service(wallet_service)
        .add_service(payment_service)
        .serve(addr);
    
    println!("✅ gRPC server is running! Press Ctrl+C to stop.");
    
    // Keep the server running
    tokio::select! {
        _ = server => {
            println!("Server stopped");
        }
        _ = tokio::signal::ctrl_c() => {
            println!("Received Ctrl+C, shutting down...");
        }
    }

    Ok(())
}