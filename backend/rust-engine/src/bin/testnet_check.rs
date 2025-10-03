use satsconnect_engine::lightning::testnet_checker::TestnetChecker;
use std::env;
use tracing::{info, Level};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("🚀 Starting Lightning Network Testnet Connectivity Check");

    // Create testnet checker
    let checker = TestnetChecker::new();

    // Print connectivity report
    checker.print_connectivity_report().await?;

    // Get network statistics
    let stats = checker.get_network_stats().await?;
    
    info!("📊 Final Network Health: {}", stats.testnet_health);
    
    if stats.connected_nodes > 0 {
        info!("✅ Testnet connectivity is healthy - {} nodes connected", stats.connected_nodes);
    } else {
        info!("❌ Testnet connectivity is unhealthy - no nodes connected");
    }

    Ok(())
}

