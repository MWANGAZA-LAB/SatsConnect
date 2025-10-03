use crate::lightning_engine::LightningEngine;
use crate::secure_storage::SecureStorage;
use anyhow::Result;
use bip39::{Language, Mnemonic};
use bitcoin::Network;
use directories::ProjectDirs;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// Simplified wallet types for HTTP API (will be replaced with gRPC later)
#[derive(Debug, Clone)]
pub struct Wallet {
    pub label: String,
    pub node_id: String,
    pub address: String,
    pub wallet_id: String,
}

#[derive(Debug)]
pub struct WalletHandler {
    wallets: Arc<RwLock<HashMap<String, Wallet>>>,
    current_wallet: Arc<RwLock<Option<String>>>,
    secure_storage: Arc<SecureStorage>,
    lightning_engine: Arc<LightningEngine>,
}

impl WalletHandler {
    pub fn new() -> Result<Self> {
        let dirs = ProjectDirs::from("com", "SatsConnect", "engine")
            .ok_or_else(|| anyhow::anyhow!("Failed to get project directories"))?;
        let data_dir = dirs.data_dir().to_path_buf();
        std::fs::create_dir_all(&data_dir)?;

        let secure_storage = Arc::new(SecureStorage::new(data_dir.clone())?);

        // Initialize Lightning engine with testnet for development
        let lightning_engine = Arc::new(LightningEngine::new(data_dir, Network::Testnet));

        Ok(Self {
            wallets: Arc::new(RwLock::new(HashMap::new())),
            current_wallet: Arc::new(RwLock::new(None)),
            secure_storage,
            lightning_engine,
        })
    }

    fn generate_mnemonic() -> Result<String> {
        let mnemonic = Mnemonic::generate_in(Language::English, 12)?;
        Ok(mnemonic.to_string())
    }

    fn generate_node_id(mnemonic: &str) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(mnemonic.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    fn generate_address(mnemonic: &str) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(mnemonic.as_bytes());
        let hash = hasher.finalize();
        format!("tb1q{}", hex::encode(&hash[..20]))
    }

    pub async fn create_wallet(
        &self,
        label: String,
        mnemonic: Option<String>,
    ) -> Result<(String, String)> {
        let mnemonic = if let Some(m) = mnemonic {
            if m.is_empty() {
                Self::generate_mnemonic()?
            } else {
                // Validate the provided mnemonic
                Mnemonic::parse(&m)?;
                m
            }
        } else {
            Self::generate_mnemonic()?
        };

        let wallet_id = uuid::Uuid::new_v4().to_string();

        // Initialize Lightning engine if not already done
        self.lightning_engine.initialize().await?;

        // Create wallet using real Lightning engine
        let (node_id, address) = self
            .lightning_engine
            .create_wallet_from_mnemonic(&mnemonic, &label)
            .await?;

        // Store mnemonic securely
        self.secure_storage.store_mnemonic(&wallet_id, &mnemonic)?;

        let wallet = Wallet {
            label: label.clone(),
            node_id: node_id.clone(),
            address: address.clone(),
            wallet_id: wallet_id.clone(),
        };

        {
            let mut wallets = self.wallets.write().await;
            wallets.insert(label.clone(), wallet);
            let mut current = self.current_wallet.write().await;
            *current = Some(label);
        }

        Ok((node_id, address))
    }

    pub async fn get_balance(&self) -> Result<(u64, u64)> {
        let current_wallet = self.current_wallet.read().await;
        let wallets = self.wallets.read().await;

        let wallet_name = current_wallet
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No wallet loaded"))?;

        let _wallet = wallets
            .get(wallet_name)
            .ok_or_else(|| anyhow::anyhow!("Wallet not found"))?;

        // Get real balances from Lightning engine
        self.lightning_engine.get_balance().await
    }

    pub async fn generate_invoice(
        &self,
        amount_sats: u64,
        memo: String,
    ) -> Result<(String, String)> {
        let current_wallet = self.current_wallet.read().await;
        let wallets = self.wallets.read().await;

        let wallet_name = current_wallet
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No wallet loaded"))?;

        let _wallet = wallets
            .get(wallet_name)
            .ok_or_else(|| anyhow::anyhow!("Wallet not found"))?;

        // Generate real Lightning invoice
        self.lightning_engine
            .generate_invoice(amount_sats, &memo)
            .await
    }

    pub async fn send_payment(&self, invoice: String) -> Result<(String, String)> {
        let current_wallet = self.current_wallet.read().await;
        let wallets = self.wallets.read().await;

        let wallet_name = current_wallet
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No wallet loaded"))?;

        let _wallet = wallets
            .get(wallet_name)
            .ok_or_else(|| anyhow::anyhow!("Wallet not found"))?;

        // Send real Lightning payment
        self.lightning_engine.send_payment(&invoice).await
    }

    pub async fn buy_airtime(
        &self,
        amount_sats: u64,
        phone_number: String,
        provider: Option<String>,
    ) -> Result<(String, String, String)> {
        let current_wallet = self.current_wallet.read().await;
        let wallets = self.wallets.read().await;

        let wallet_name = current_wallet
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No wallet loaded"))?;

        let _wallet = wallets
            .get(wallet_name)
            .ok_or_else(|| anyhow::anyhow!("Wallet not found"))?;

        // Buy airtime using real Lightning engine
        self.lightning_engine
            .buy_airtime(amount_sats, &phone_number, provider.as_deref())
            .await
    }
}
