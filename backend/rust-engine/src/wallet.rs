use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use bip39::{Mnemonic, Language};
use anyhow::Result;
use directories::ProjectDirs;
use crate::secure_storage::SecureStorage;

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
}

impl WalletHandler {
    pub fn new() -> Result<Self> {
        let dirs = ProjectDirs::from("com", "SatsConnect", "engine")
            .ok_or_else(|| anyhow::anyhow!("Failed to get project directories"))?;
        let data_dir = dirs.data_dir().to_path_buf();
        std::fs::create_dir_all(&data_dir)?;
        
        let secure_storage = Arc::new(SecureStorage::new(data_dir)?);
        
        Ok(Self {
            wallets: Arc::new(RwLock::new(HashMap::new())),
            current_wallet: Arc::new(RwLock::new(None)),
            secure_storage,
        })
    }

    fn generate_mnemonic() -> Result<String> {
        let mnemonic = Mnemonic::generate_in(Language::English, 12)?;
        Ok(mnemonic.to_string())
    }

    fn generate_node_id(mnemonic: &str) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(mnemonic.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    fn generate_address(mnemonic: &str) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(mnemonic.as_bytes());
        let hash = hasher.finalize();
        format!("tb1q{}", hex::encode(&hash[..20]))
    }

    pub async fn create_wallet(&self, label: String, mnemonic: Option<String>) -> Result<(String, String)> {
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
        let node_id = Self::generate_node_id(&mnemonic);
        let address = Self::generate_address(&mnemonic);

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

        let wallet_name = current_wallet.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No wallet loaded"))?;

        let _wallet = wallets.get(wallet_name)
            .ok_or_else(|| anyhow::anyhow!("Wallet not found"))?;

        // Mock balances - return some test values
        let onchain = 1000000; // 1M sats
        let ln = 500000; // 500K sats
        Ok((onchain, ln))
    }

    pub async fn generate_invoice(&self, amount_sats: u64, memo: String) -> Result<(String, String)> {
        let current_wallet = self.current_wallet.read().await;
        let wallets = self.wallets.read().await;

        let wallet_name = current_wallet.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No wallet loaded"))?;

        let _wallet = wallets.get(wallet_name)
            .ok_or_else(|| anyhow::anyhow!("Wallet not found"))?;

        // Mock Lightning invoice generation
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(format!("{}{}", amount_sats, memo).as_bytes());
        let payment_hash = format!("{:x}", hasher.finalize());
        let invoice = format!("lnbc{}u1p3k2v5cpp5{}", amount_sats, payment_hash);
        Ok((invoice, payment_hash))
    }

    pub async fn send_payment(&self, invoice: String) -> Result<(String, String)> {
        let current_wallet = self.current_wallet.read().await;
        let wallets = self.wallets.read().await;

        let wallet_name = current_wallet.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No wallet loaded"))?;

        let _wallet = wallets.get(wallet_name)
            .ok_or_else(|| anyhow::anyhow!("Wallet not found"))?;

        // Mock payment processing
        if !invoice.starts_with("lnbc") {
            return Err(anyhow::anyhow!("Invalid Lightning invoice format"));
        }
        
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(invoice.as_bytes());
        let payment_hash = format!("{:x}", hasher.finalize());
        let status = "SUCCEEDED".to_string();
        Ok((payment_hash, status))
    }

    pub async fn buy_airtime(&self, amount_sats: u64, phone_number: String, provider: Option<String>) -> Result<(String, String, String)> {
        let current_wallet = self.current_wallet.read().await;
        let wallets = self.wallets.read().await;

        let wallet_name = current_wallet.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No wallet loaded"))?;

        let _wallet = wallets.get(wallet_name)
            .ok_or_else(|| anyhow::anyhow!("Wallet not found"))?;

        // Mock airtime purchase - create an invoice for airtime
        let memo = format!("Airtime for {} via {}", phone_number, provider.unwrap_or_else(|| "default".to_string()));
        let (invoice, payment_hash) = self.generate_invoice(amount_sats, memo).await?;
        
        Ok((invoice, payment_hash, "PENDING".to_string()))
    }
}