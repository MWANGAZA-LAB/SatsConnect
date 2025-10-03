use satsconnect_engine::lightning::regtest_setup::{RegtestSetup, RegtestNode};
use std::path::PathBuf;
use tracing::{info, Level};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("🚀 Starting SatsConnect Regtest Lightning Network Demo");

    // Create regtest setup
    let data_dir = PathBuf::from("./regtest_data");
    let mut setup = RegtestSetup::new(data_dir);

    // Create 3 test nodes
    info!("Creating regtest Lightning nodes...");
    setup.create_test_nodes(3).await?;

    // Print network status
    setup.print_network_status();

    // Connect nodes
    info!("\n🔗 Connecting nodes...");
    setup.connect_nodes("node_1", "node_2").await?;
    setup.connect_nodes("node_2", "node_3").await?;
    setup.connect_nodes("node_1", "node_3").await?;

    // Create test invoices
    info!("\n💰 Creating test invoices...");
    let (invoice1, hash1) = setup
        .create_test_invoice("node_1", 1000, "Test invoice 1")
        .await?;
    let (invoice2, hash2) = setup
        .create_test_invoice("node_2", 2500, "Test invoice 2")
        .await?;

    info!("Invoice 1: {} (Hash: {})", invoice1, hash1);
    info!("Invoice 2: {} (Hash: {})", invoice2, hash2);

    // Send test payments
    info!("\n💸 Sending test payments...");
    let payment1 = setup
        .send_test_payment("node_2", "node_1", 1000)
        .await?;
    let payment2 = setup
        .send_test_payment("node_3", "node_2", 2500)
        .await?;

    info!("Payment 1 completed: {}", payment1);
    info!("Payment 2 completed: {}", payment2);

    // Get final network stats
    let stats = setup.get_network_stats();
    info!("\n📊 Final Network Statistics:");
    info!("   Total Nodes: {}", stats.total_nodes);
    info!("   Active Nodes: {}", stats.active_nodes);
    info!("   Network Type: {}", stats.network_type);

    info!("\n✅ Regtest Lightning Network demo completed successfully!");
    info!("🎯 All nodes are running and can be used for development and testing");

    // Keep nodes running for a bit to demonstrate
    info!("\n⏳ Keeping nodes running for 30 seconds for demonstration...");
    tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;

    // Stop all nodes
    info!("\n🛑 Stopping all regtest nodes...");
    setup.stop_all_nodes().await?;

    info!("👋 Demo completed. All nodes stopped.");

    Ok(())
}
