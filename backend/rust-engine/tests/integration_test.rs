use anyhow::Result;
use bitcoin::Network;
use satsconnect_rust_engine::lightning_engine::LightningEngine;
use satsconnect_rust_engine::wallet::WalletHandler;
use tempfile::tempdir;

#[tokio::test]
async fn test_lightning_engine_integration() -> Result<()> {
    // Create temporary directory for test data
    let temp_dir = tempdir()?;
    let data_dir = temp_dir.path().to_path_buf();

    // Initialize Lightning engine
    let engine = LightningEngine::new(data_dir.clone(), Network::Regtest);

    // Test wallet creation
    let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    let (node_id, address) = engine
        .create_wallet_from_mnemonic(mnemonic, "test-wallet")
        .await?;

    assert!(!node_id.is_empty());
    assert!(!address.is_empty());
    println!(
        "✅ Wallet created - Node ID: {}, Address: {}",
        node_id, address
    );

    // Test balance retrieval
    let (onchain_balance, lightning_balance) = engine.get_balance().await?;
    println!(
        "✅ Balance retrieved - On-chain: {} sats, Lightning: {} sats",
        onchain_balance, lightning_balance
    );
    
    // Test invoice generation
    let (invoice, payment_hash) = engine.generate_invoice(1000, "Test invoice").await?;
    assert!(!invoice.is_empty());
    assert!(!payment_hash.is_empty());
    println!("✅ Invoice generated - Payment Hash: {}", payment_hash);

    // Test airtime purchase
    let (airtime_invoice, airtime_hash, status) = engine
        .buy_airtime(500, "254700000000", Some("Safaricom"))
        .await?;
    assert!(!airtime_invoice.is_empty());
    assert!(!airtime_hash.is_empty());
    assert_eq!(status, "PENDING");
    println!("✅ Airtime purchase initiated - Status: {}", status);

    Ok(())
}

#[tokio::test]
async fn test_wallet_handler_integration() -> Result<()> {
    // Create wallet handler
    let wallet_handler = WalletHandler::new()?;

    // Test wallet creation
    let (node_id, address) = wallet_handler
        .create_wallet("test-wallet".to_string(), None)
        .await?;
    assert!(!node_id.is_empty());
    assert!(!address.is_empty());
    println!(
        "✅ Wallet handler created wallet - Node ID: {}, Address: {}",
        node_id, address
    );

    // Test balance retrieval
    let (onchain_balance, lightning_balance) = wallet_handler.get_balance().await?;
    println!(
        "✅ Wallet handler balance - On-chain: {} sats, Lightning: {} sats",
        onchain_balance, lightning_balance
    );
    
    // Test invoice generation
    let (invoice, payment_hash) = wallet_handler
        .generate_invoice(1000, "Test invoice".to_string())
        .await?;
    assert!(!invoice.is_empty());
    assert!(!payment_hash.is_empty());
    println!(
        "✅ Wallet handler invoice generated - Payment Hash: {}",
        payment_hash
    );

    // Test airtime purchase
    let (airtime_invoice, airtime_hash, status) = wallet_handler
        .buy_airtime(
            500,
            "254700000000".to_string(),
            Some("Safaricom".to_string()),
        )
        .await?;
    assert!(!airtime_invoice.is_empty());
    assert!(!airtime_hash.is_empty());
    assert_eq!(status, "PENDING");
    println!("✅ Wallet handler airtime purchase - Status: {}", status);

    Ok(())
}

#[tokio::test]
async fn test_mnemonic_validation() -> Result<()> {
    let wallet_handler = WalletHandler::new()?;

    // Test with valid mnemonic
    let valid_mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    let (node_id, address) = wallet_handler
        .create_wallet("valid-wallet".to_string(), Some(valid_mnemonic.to_string()))
        .await?;
    assert!(!node_id.is_empty());
    assert!(!address.is_empty());
    println!("✅ Valid mnemonic accepted");

    // Test with invalid mnemonic (should fail)
    let invalid_mnemonic = "invalid mnemonic phrase that should fail validation";
    let result = wallet_handler
        .create_wallet(
            "invalid-wallet".to_string(),
            Some(invalid_mnemonic.to_string()),
        )
        .await;
    assert!(result.is_err());
    println!("✅ Invalid mnemonic rejected");

    Ok(())
}
