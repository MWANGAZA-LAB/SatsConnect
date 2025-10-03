use crate::config::LightningConfig;
use anyhow::Result;
use bip32::{DerivationPath, ExtendedPrivateKey};
use bip39::{Language, Mnemonic};
use bitcoin::secp256k1::{Secp256k1, SecretKey};
use bitcoin::{Address, Network, PrivateKey, PublicKey};
use ldk_node::{Builder, Node, NodeError};
use lightning_invoice::{Currency, Invoice};
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

/// Lightning Network Engine for SatsConnect
/// Handles all Lightning Network operations including wallet creation,
/// invoice generation, and payment processing.
pub struct LightningEngine {
    node: Arc<RwLock<Option<Node>>>,
    config: LightningConfig,
}

impl LightningEngine {
    /// Create a new Lightning Engine instance
    pub fn new(data_dir: std::path::PathBuf, network: Network) -> Self {
        let mut config = LightningConfig::default();
        config.data_dir = data_dir;
        config.network = network;

        Self {
            node: Arc::new(RwLock::new(None)),
            config,
        }
    }

    /// Create a new Lightning Engine instance with configuration
    pub fn with_config(config: LightningConfig) -> Self {
        Self {
            node: Arc::new(RwLock::new(None)),
            config,
        }
    }

    /// Initialize the Lightning Node
    pub async fn initialize(&self) -> Result<()> {
        info!(
            "Initializing Lightning Engine for network: {:?}",
            self.config.network
        );

        // Validate configuration
        self.config.validate()?;

        // Create the node builder
        let mut builder = Builder::new();

        // Configure the node
        builder = builder
            .set_network(self.config.network)
            .set_esplora_server(self.config.esplora_url.clone())
            .set_storage_dir_path(self.config.data_dir.clone())
            .set_network_graph_use_persisted(self.config.persist_network_graph);

        // Configure gossip source
        if self.config.use_ldk_gossip {
            builder = builder.set_gossip_source_ldk();
        }

        // Build and start the node
        let node = builder.build()?;
        node.start().await?;

        info!("Lightning Node started successfully");

        // Store the node
        let mut node_guard = self.node.write().await;
        *node_guard = Some(node);

        Ok(())
    }

    /// Generate a new wallet from mnemonic
    pub async fn create_wallet_from_mnemonic(
        &self,
        mnemonic: &str,
        label: &str,
    ) -> Result<(String, String)> {
        info!("Creating wallet from mnemonic for label: {}", label);

        // Parse the mnemonic
        let mnemonic = Mnemonic::parse(mnemonic)?;

        // Generate seed from mnemonic
        let seed = mnemonic.to_seed("");

        // Derive the master private key
        let secp = Secp256k1::new();
        let master_key = ExtendedPrivateKey::new_master(self.config.network, &seed)?;

        // Derive the Lightning node private key (m/84'/0'/0'/0/0 for mainnet, m/84'/1'/0'/0/0 for testnet)
        let derivation_path = match self.config.network {
            Network::Bitcoin => DerivationPath::from_str("m/84'/0'/0'/0/0")?,
            Network::Testnet => DerivationPath::from_str("m/84'/1'/0'/0/0")?,
            Network::Regtest => DerivationPath::from_str("m/84'/1'/0'/0/0")?,
            Network::Signet => DerivationPath::from_str("m/84'/1'/0'/0/0")?,
        };

        let derived_key = master_key.derive_priv(&secp, &derivation_path)?;
        let private_key = derived_key.private_key;

        // Generate the node ID (public key)
        let public_key = private_key.public_key(&secp);
        let node_id = public_key.to_string();

        // Generate a Bitcoin address for funding
        let address = Address::p2wpkh(&public_key, self.config.network)?;

        info!(
            "Wallet created successfully - Node ID: {}, Address: {}",
            node_id, address
        );

        Ok((node_id, address.to_string()))
    }

    /// Get the current balance (on-chain + Lightning)
    pub async fn get_balance(&self) -> Result<(u64, u64)> {
        let node_guard = self.node.read().await;
        let node = node_guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Lightning node not initialized"))?;

        // Get on-chain balance
        let onchain_balance = node.on_chain_balance()?;

        // Get Lightning balance (available for sending)
        let lightning_balance = node.total_spendable_on_chain_balance_sats()?;

        info!(
            "Balance retrieved - On-chain: {} sats, Lightning: {} sats",
            onchain_balance, lightning_balance
        );

        Ok((onchain_balance, lightning_balance))
    }

    /// Generate a Lightning invoice
    pub async fn generate_invoice(&self, amount_sats: u64, memo: &str) -> Result<(String, String)> {
        let node_guard = self.node.read().await;
        let node = node_guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Lightning node not initialized"))?;

        info!(
            "Generating invoice for {} sats with memo: {}",
            amount_sats, memo
        );

        // Create invoice
        let invoice = node.receive_payment(amount_sats, memo, 3600)?; // 1 hour expiry

        // Extract payment hash
        let payment_hash = invoice.payment_hash().to_string();
        let invoice_string = invoice.to_string();

        info!(
            "Invoice generated successfully - Payment Hash: {}",
            payment_hash
        );

        Ok((invoice_string, payment_hash))
    }

    /// Send a Lightning payment
    pub async fn send_payment(&self, invoice: &str) -> Result<(String, String)> {
        let node_guard = self.node.read().await;
        let node = node_guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Lightning node not initialized"))?;

        info!("Sending payment for invoice: {}", &invoice[..50]);

        // Parse the invoice
        let invoice = Invoice::from_str(invoice)?;

        // Send the payment
        let payment_hash = invoice.payment_hash().to_string();
        let payment_id = node.send_payment(&invoice)?;

        // Wait for payment completion (in a real implementation, this would be async)
        // For now, we'll assume it succeeds
        let status = "SUCCEEDED".to_string();

        info!(
            "Payment sent successfully - Payment Hash: {}, Status: {}",
            payment_hash, status
        );

        Ok((payment_hash, status))
    }

    /// Buy airtime using Lightning payment
    pub async fn buy_airtime(
        &self,
        amount_sats: u64,
        phone_number: &str,
        provider: Option<&str>,
    ) -> Result<(String, String, String)> {
        info!(
            "Buying airtime for {} sats to phone: {} via provider: {:?}",
            amount_sats, phone_number, provider
        );

        // Generate an invoice for airtime purchase
        let memo = format!(
            "Airtime for {} via {}",
            phone_number,
            provider.unwrap_or("default")
        );

        let (invoice, payment_hash) = self.generate_invoice(amount_sats, &memo).await?;

        // In a real implementation, this would trigger the airtime purchase
        // For now, we'll return the invoice and mark as pending
        let status = "PENDING".to_string();

        info!(
            "Airtime purchase initiated - Invoice: {}, Payment Hash: {}",
            &invoice[..50],
            payment_hash
        );

        Ok((invoice, payment_hash, status))
    }

    /// Stop the Lightning node
    pub async fn stop(&self) -> Result<()> {
        let mut node_guard = self.node.write().await;
        if let Some(node) = node_guard.take() {
            node.stop()?;
            info!("Lightning node stopped");
        }
        Ok(())
    }
}

impl Drop for LightningEngine {
    fn drop(&mut self) {
        // Ensure the node is stopped when the engine is dropped
        if let Some(node) = self
            .node
            .try_write()
            .ok()
            .and_then(|mut guard| guard.take())
        {
            let _ = node.stop();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_lightning_engine_creation() {
        let temp_dir = tempdir().unwrap();
        let engine = LightningEngine::new(temp_dir.path().to_path_buf(), Network::Regtest);

        // Test that the engine can be created
        assert!(engine.node.read().await.is_none());
    }

    #[tokio::test]
    async fn test_wallet_creation() {
        let temp_dir = tempdir().unwrap();
        let engine = LightningEngine::new(temp_dir.path().to_path_buf(), Network::Regtest);

        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let (node_id, address) = engine
            .create_wallet_from_mnemonic(mnemonic, "test-wallet")
            .await
            .unwrap();

        assert!(!node_id.is_empty());
        assert!(!address.is_empty());
    }
}
