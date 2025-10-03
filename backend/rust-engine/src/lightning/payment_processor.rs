use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;

/// Payment processor for handling Lightning Network payments
#[derive(Debug, Clone)]
pub struct PaymentProcessor {
    payments: RwLock<HashMap<String, PaymentInfo>>,
}

/// Information about a payment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentInfo {
    pub payment_hash: String,
    pub amount_msat: u64,
    pub destination: String,
    pub state: PaymentState,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub failure_reason: Option<String>,
}

/// Payment state enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PaymentState {
    Pending,
    InFlight,
    Succeeded,
    Failed,
}

impl PaymentProcessor {
    /// Create a new payment processor
    pub fn new() -> Self {
        Self {
            payments: RwLock::new(HashMap::new()),
        }
    }

    /// Create a new payment
    pub async fn create_payment(
        &self,
        payment_hash: String,
        amount_msat: u64,
        destination: String,
    ) -> Result<PaymentInfo, String> {
        let payment_info = PaymentInfo {
            payment_hash: payment_hash.clone(),
            amount_msat,
            destination,
            state: PaymentState::Pending,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            completed_at: None,
            failure_reason: None,
        };

        let mut payments = self.payments.write().await;
        payments.insert(payment_hash.clone(), payment_info.clone());

        Ok(payment_info)
    }

    /// Get payment information
    pub async fn get_payment(&self, payment_hash: &str) -> Option<PaymentInfo> {
        let payments = self.payments.read().await;
        payments.get(payment_hash).cloned()
    }

    /// Update payment state
    pub async fn update_payment_state(
        &self,
        payment_hash: &str,
        state: PaymentState,
        failure_reason: Option<String>,
    ) -> Result<(), String> {
        let mut payments = self.payments.write().await;

        if let Some(payment) = payments.get_mut(payment_hash) {
            payment.state = state;
            payment.failure_reason = failure_reason;

            if state == PaymentState::Succeeded || state == PaymentState::Failed {
                payment.completed_at = Some(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                );
            }

            Ok(())
        } else {
            Err("Payment not found".to_string())
        }
    }

    /// Get all payments
    pub async fn get_all_payments(&self) -> Vec<PaymentInfo> {
        let payments = self.payments.read().await;
        payments.values().cloned().collect()
    }

    /// Get payments by state
    pub async fn get_payments_by_state(&self, state: PaymentState) -> Vec<PaymentInfo> {
        let payments = self.payments.read().await;
        payments
            .values()
            .filter(|p| p.state == state)
            .cloned()
            .collect()
    }

    /// Process a payment
    pub async fn process_payment(
        &self,
        payment_hash: &str,
        amount_msat: u64,
        destination: &str,
    ) -> Result<PaymentInfo, String> {
        // Update state to in-flight
        self.update_payment_state(payment_hash, PaymentState::InFlight, None)
            .await?;

        // Simulate payment processing
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // For now, always succeed (in real implementation, this would interact with LDK)
        self.update_payment_state(payment_hash, PaymentState::Succeeded, None)
            .await?;

        self.get_payment(payment_hash)
            .await
            .ok_or_else(|| "Payment not found after processing".to_string())
    }

    /// Cancel a payment
    pub async fn cancel_payment(&self, payment_hash: &str) -> Result<(), String> {
        self.update_payment_state(
            payment_hash,
            PaymentState::Failed,
            Some("Payment cancelled by user".to_string()),
        )
        .await
    }
}

impl Default for PaymentProcessor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_payment() {
        let processor = PaymentProcessor::new();
        let payment_hash = "test_hash_123".to_string();
        let amount_msat = 100000; // 1000 sats
        let destination = "test_destination".to_string();

        let payment = processor
            .create_payment(payment_hash.clone(), amount_msat, destination)
            .await
            .unwrap();

        assert_eq!(payment.payment_hash, payment_hash);
        assert_eq!(payment.amount_msat, amount_msat);
        assert_eq!(payment.state, PaymentState::Pending);
    }

    #[tokio::test]
    async fn test_update_payment_state() {
        let processor = PaymentProcessor::new();
        let payment_hash = "test_hash_456".to_string();

        processor
            .create_payment(payment_hash.clone(), 50000, "dest".to_string())
            .await
            .unwrap();

        processor
            .update_payment_state(&payment_hash, PaymentState::Succeeded, None)
            .await
            .unwrap();

        let payment = processor.get_payment(&payment_hash).await.unwrap();
        assert_eq!(payment.state, PaymentState::Succeeded);
        assert!(payment.completed_at.is_some());
    }
}
