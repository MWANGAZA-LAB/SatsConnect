use crate::performance::async_lightning_engine::AsyncLightningEngine;
use anyhow::Result;
use bitcoin::Network;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{timeout, Duration};
use tracing::{error, info, instrument, warn};
use uuid::Uuid;

/// High-performance payment processor with async operations and retry logic
#[derive(Debug)]
pub struct PaymentProcessor {
    payments: Arc<RwLock<HashMap<String, Payment>>>,
    lightning_engine: Arc<AsyncLightningEngine>,
    retry_queue: Arc<RwLock<Vec<RetryItem>>>,
    max_retries: u32,
    retry_delay: Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub payment_id: String,
    pub wallet_id: String,
    pub amount_sats: u64,
    pub invoice: String,
    pub description: String,
    pub status: PaymentStatus,
    pub payment_hash: String,
    pub created_at: String,
    pub updated_at: String,
    pub retry_count: u32,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PaymentStatus {
    Pending,
    Processing,
    Succeeded,
    Failed,
    Retrying,
    Cancelled,
}

#[derive(Debug, Clone)]
struct RetryItem {
    payment_id: String,
    retry_count: u32,
    next_retry_at: chrono::DateTime<Utc>,
    error: String,
}

impl PaymentProcessor {
    /// Create a new high-performance payment processor
    pub fn new(data_dir: std::path::PathBuf, network: Network) -> Self {
        Self {
            payments: Arc::new(RwLock::new(HashMap::new())),
            lightning_engine: Arc::new(AsyncLightningEngine::new(data_dir, network)),
            retry_queue: Arc::new(RwLock::new(Vec::new())),
            max_retries: 3,
            retry_delay: Duration::from_secs(5),
        }
    }

    /// Initialize the payment processor
    #[instrument(skip(self))]
    pub async fn initialize(&self) -> Result<()> {
        info!("Initializing high-performance payment processor");

        // Initialize Lightning engine
        self.lightning_engine.initialize().await?;

        // Start background retry processor
        self.start_retry_processor().await;

        info!("Payment processor initialized successfully");
        Ok(())
    }

    /// Process a payment asynchronously
    #[instrument(skip(self))]
    pub async fn process_payment(
        &self,
        payment_id: Option<String>,
        wallet_id: String,
        amount_sats: u64,
        invoice: String,
        description: String,
    ) -> Result<Payment> {
        let payment_id = payment_id.unwrap_or_else(|| Self::generate_id());

        info!(
            "Processing payment: {} for {} sats",
            payment_id, amount_sats
        );

        // Create payment record
        let mut payment = Payment {
            payment_id: payment_id.clone(),
            wallet_id,
            amount_sats,
            invoice: invoice.clone(),
            description,
            status: PaymentStatus::Pending,
            payment_hash: String::new(),
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
            retry_count: 0,
            error_message: None,
        };

        // Store payment
        {
            let mut payments = self.payments.write().await;
            payments.insert(payment_id.clone(), payment.clone());
        }

        // Process payment asynchronously
        let processor = self.clone();
        let payment_id_clone = payment_id.clone();
        tokio::spawn(async move {
            if let Err(e) = processor.process_payment_async(payment_id_clone).await {
                error!("Payment processing failed: {}", e);
            }
        });

        Ok(payment)
    }

    /// Process payment asynchronously with retry logic
    #[instrument(skip(self))]
    async fn process_payment_async(&self, payment_id: String) -> Result<()> {
        let mut retry_count = 0;

        while retry_count <= self.max_retries {
            // Update status to processing
            self.update_payment_status(&payment_id, PaymentStatus::Processing, None)
                .await?;

            // Process payment with timeout
            let result = timeout(Duration::from_secs(30), async {
                self.lightning_engine
                    .send_payment(&self.get_payment_invoice(&payment_id).await?)
                    .await
            })
            .await;

            match result {
                Ok(Ok((payment_hash, status))) => {
                    // Payment succeeded
                    self.update_payment_success(&payment_id, payment_hash, status)
                        .await?;
                    info!("Payment {} processed successfully", payment_id);
                    return Ok(());
                }
                Ok(Err(e)) => {
                    // Payment failed, check if we should retry
                    if retry_count < self.max_retries {
                        retry_count += 1;
                        warn!(
                            "Payment {} failed (attempt {}), retrying: {}",
                            payment_id, retry_count, e
                        );

                        // Add to retry queue
                        self.add_to_retry_queue(&payment_id, retry_count, e.to_string())
                            .await?;

                        // Wait before retry
                        tokio::time::sleep(self.retry_delay * retry_count).await;
                    } else {
                        // Max retries exceeded
                        self.update_payment_failure(&payment_id, e.to_string())
                            .await?;
                        error!(
                            "Payment {} failed after {} retries: {}",
                            payment_id, self.max_retries, e
                        );
                        return Err(e);
                    }
                }
                Err(_) => {
                    // Timeout
                    let error_msg = "Payment processing timed out".to_string();
                    if retry_count < self.max_retries {
                        retry_count += 1;
                        warn!(
                            "Payment {} timed out (attempt {}), retrying",
                            payment_id, retry_count
                        );

                        self.add_to_retry_queue(&payment_id, retry_count, error_msg.clone())
                            .await?;
                        tokio::time::sleep(self.retry_delay * retry_count).await;
                    } else {
                        self.update_payment_failure(&payment_id, error_msg.clone())
                            .await?;
                        return Err(anyhow::anyhow!(error_msg));
                    }
                }
            }
        }

        Ok(())
    }

    /// Get payment status
    #[instrument(skip(self))]
    pub async fn get_payment_status(&self, payment_id: &str) -> Result<Payment> {
        let payments = self.payments.read().await;
        payments
            .get(payment_id)
            .ok_or_else(|| anyhow::anyhow!("Payment not found"))
            .map(|p| p.clone())
    }

    /// Get all payments for a wallet
    #[instrument(skip(self))]
    pub async fn get_wallet_payments(&self, wallet_id: &str) -> Result<Vec<Payment>> {
        let payments = self.payments.read().await;
        Ok(payments
            .values()
            .filter(|p| p.wallet_id == wallet_id)
            .cloned()
            .collect())
    }

    /// Cancel a payment
    #[instrument(skip(self))]
    pub async fn cancel_payment(&self, payment_id: &str) -> Result<Payment> {
        let mut payments = self.payments.write().await;
        let payment = payments
            .get_mut(payment_id)
            .ok_or_else(|| anyhow::anyhow!("Payment not found"))?;

        if payment.status == PaymentStatus::Succeeded {
            return Err(anyhow::anyhow!("Cannot cancel completed payment"));
        }

        payment.status = PaymentStatus::Cancelled;
        payment.updated_at = Utc::now().to_rfc3339();

        Ok(payment.clone())
    }

    /// Get payment metrics
    #[instrument(skip(self))]
    pub async fn get_metrics(&self) -> Result<PaymentMetrics> {
        let payments = self.payments.read().await;
        let retry_queue = self.retry_queue.read().await;

        let total_payments = payments.len();
        let pending_payments = payments
            .values()
            .filter(|p| p.status == PaymentStatus::Pending)
            .count();
        let processing_payments = payments
            .values()
            .filter(|p| p.status == PaymentStatus::Processing)
            .count();
        let succeeded_payments = payments
            .values()
            .filter(|p| p.status == PaymentStatus::Succeeded)
            .count();
        let failed_payments = payments
            .values()
            .filter(|p| p.status == PaymentStatus::Failed)
            .count();
        let retry_queue_size = retry_queue.len();

        Ok(PaymentMetrics {
            total_payments,
            pending_payments,
            processing_payments,
            succeeded_payments,
            failed_payments,
            retry_queue_size,
            success_rate: if total_payments > 0 {
                (succeeded_payments as f64 / total_payments as f64) * 100.0
            } else {
                0.0
            },
        })
    }

    /// Start background retry processor
    async fn start_retry_processor(&self) {
        let processor = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(10));

            loop {
                interval.tick().await;

                if let Err(e) = processor.process_retry_queue().await {
                    error!("Retry processor error: {}", e);
                }
            }
        });
    }

    /// Process retry queue
    async fn process_retry_queue(&self) -> Result<()> {
        let now = Utc::now();
        let mut retry_queue = self.retry_queue.write().await;
        let mut to_retry = Vec::new();

        // Find items ready for retry
        let mut i = 0;
        while i < retry_queue.len() {
            if retry_queue[i].next_retry_at <= now {
                to_retry.push(retry_queue.remove(i));
            } else {
                i += 1;
            }
        }

        drop(retry_queue);

        // Process retry items
        for item in to_retry {
            info!(
                "Retrying payment: {} (attempt {})",
                item.payment_id, item.retry_count
            );

            if let Err(e) = self.process_payment_async(item.payment_id.clone()).await {
                error!("Retry failed for payment {}: {}", item.payment_id, e);
            }
        }

        Ok(())
    }

    /// Add payment to retry queue
    async fn add_to_retry_queue(
        &self,
        payment_id: &str,
        retry_count: u32,
        error: String,
    ) -> Result<()> {
        let mut retry_queue = self.retry_queue.write().await;
        retry_queue.push(RetryItem {
            payment_id: payment_id.to_string(),
            retry_count,
            next_retry_at: Utc::now() + chrono::Duration::seconds(5 * retry_count as i64),
            error,
        });
        Ok(())
    }

    /// Update payment status
    async fn update_payment_status(
        &self,
        payment_id: &str,
        status: PaymentStatus,
        error: Option<String>,
    ) -> Result<()> {
        let mut payments = self.payments.write().await;
        if let Some(payment) = payments.get_mut(payment_id) {
            payment.status = status;
            payment.updated_at = Utc::now().to_rfc3339();
            payment.error_message = error;
        }
        Ok(())
    }

    /// Update payment success
    async fn update_payment_success(
        &self,
        payment_id: &str,
        payment_hash: String,
        status: String,
    ) -> Result<()> {
        let mut payments = self.payments.write().await;
        if let Some(payment) = payments.get_mut(payment_id) {
            payment.status = PaymentStatus::Succeeded;
            payment.payment_hash = payment_hash;
            payment.updated_at = Utc::now().to_rfc3339();
            payment.error_message = None;
        }
        Ok(())
    }

    /// Update payment failure
    async fn update_payment_failure(&self, payment_id: &str, error: String) -> Result<()> {
        let mut payments = self.payments.write().await;
        if let Some(payment) = payments.get_mut(payment_id) {
            payment.status = PaymentStatus::Failed;
            payment.updated_at = Utc::now().to_rfc3339();
            payment.error_message = Some(error);
        }
        Ok(())
    }

    /// Get payment invoice
    async fn get_payment_invoice(&self, payment_id: &str) -> Result<String> {
        let payments = self.payments.read().await;
        let payment = payments
            .get(payment_id)
            .ok_or_else(|| anyhow::anyhow!("Payment not found"))?;
        Ok(payment.invoice.clone())
    }

    /// Generate unique payment ID
    fn generate_id() -> String {
        format!("pay_{}", Uuid::new_v4().to_string()[..8].to_string())
    }
}

impl Clone for PaymentProcessor {
    fn clone(&self) -> Self {
        Self {
            payments: self.payments.clone(),
            lightning_engine: self.lightning_engine.clone(),
            retry_queue: self.retry_queue.clone(),
            max_retries: self.max_retries,
            retry_delay: self.retry_delay,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentMetrics {
    pub total_payments: usize,
    pub pending_payments: usize,
    pub processing_payments: usize,
    pub succeeded_payments: usize,
    pub failed_payments: usize,
    pub retry_queue_size: usize,
    pub success_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_payment_processor_creation() {
        let temp_dir = tempdir().unwrap();
        let processor = PaymentProcessor::new(temp_dir.path().to_path_buf(), Network::Testnet);

        assert_eq!(processor.max_retries, 3);
        assert_eq!(processor.retry_delay, Duration::from_secs(5));
    }

    #[tokio::test]
    async fn test_payment_creation() {
        let temp_dir = tempdir().unwrap();
        let processor = PaymentProcessor::new(temp_dir.path().to_path_buf(), Network::Testnet);

        let payment = processor
            .process_payment(
                None,
                "wallet_123".to_string(),
                1000,
                "lnbc10n1...".to_string(),
                "Test payment".to_string(),
            )
            .await;

        assert!(payment.is_ok());
        let payment = payment.unwrap();
        assert_eq!(payment.amount_sats, 1000);
        assert_eq!(payment.status, PaymentStatus::Pending);
    }
}
