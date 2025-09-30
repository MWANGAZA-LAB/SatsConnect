use crate::lightning_engine::LightningEngine;
use anyhow::Result;
use bitcoin::Network;
use chrono::Utc;
use directories::ProjectDirs;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// Simplified payment types for HTTP API (will be replaced with gRPC later)
#[derive(Debug, Clone)]
pub struct Payment {
    pub payment_id: String,
    pub wallet_id: String,
    pub amount_sats: u64,
    pub invoice: String,
    pub description: String,
    pub status: String,
    pub payment_hash: String,
    pub timestamp: String,
}

#[derive(Debug)]
pub struct PaymentHandler {
    payments: Arc<RwLock<HashMap<String, Payment>>>,
    lightning_engine: Arc<LightningEngine>,
}

impl PaymentHandler {
    pub fn new() -> Result<Self> {
        let dirs = ProjectDirs::from("com", "SatsConnect", "engine")
            .ok_or_else(|| anyhow::anyhow!("Failed to get project directories"))?;
        let data_dir = dirs.data_dir().to_path_buf();
        std::fs::create_dir_all(&data_dir)?;

        // Initialize Lightning engine with testnet for development
        let lightning_engine = Arc::new(LightningEngine::new(data_dir, Network::Testnet));

        Ok(Self {
            payments: Arc::new(RwLock::new(HashMap::new())),
            lightning_engine,
        })
    }

    fn generate_id() -> String {
        format!("pay_{}", &uuid::Uuid::new_v4().to_string()[..8])
    }

    pub async fn process_payment(
        &self,
        payment_id: Option<String>,
        wallet_id: String,
        amount_sats: u64,
        invoice: String,
        description: String,
    ) -> Result<Payment> {
        let payment_id = if let Some(id) = payment_id {
            id
        } else {
            Self::generate_id()
        };

        // Initialize Lightning engine if not already done
        self.lightning_engine.initialize().await?;

        // Send payment using real Lightning engine
        let (payment_hash, status) = self.lightning_engine.send_payment(&invoice).await?;

        let payment = Payment {
            payment_id: payment_id.clone(),
            wallet_id,
            amount_sats,
            invoice: invoice.clone(),
            description,
            status,
            payment_hash,
            timestamp: Utc::now().to_rfc3339(),
        };

        {
            let mut payments = self.payments.write().await;
            payments.insert(payment_id.clone(), payment.clone());
        }

        Ok(payment)
    }

    pub async fn get_payment_status(&self, payment_id: String) -> Result<Payment> {
        let payments = self.payments.read().await;

        let payment = payments
            .get(&payment_id)
            .ok_or_else(|| anyhow::anyhow!("Payment not found"))?
            .clone();

        Ok(payment)
    }

    pub async fn process_refund(&self, payment_id: String, _amount_sats: u64) -> Result<Payment> {
        let mut payments = self.payments.write().await;

        let payment = payments
            .get_mut(&payment_id)
            .ok_or_else(|| anyhow::anyhow!("Payment not found"))?;

        if payment.status != "COMPLETED" {
            return Err(anyhow::anyhow!("Cannot refund non-completed payment"));
        }

        payment.status = "REFUNDED".to_string();

        Ok(payment.clone())
    }
}

impl Default for PaymentHandler {
    fn default() -> Self {
        Self::new()
    }
}
