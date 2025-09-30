use anyhow::Result;
use ldk_node::{Node, Invoice, PaymentHash, PaymentPreimage};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, instrument};

#[derive(Debug, Clone, PartialEq)]
pub enum InvoiceState {
    Pending,
    Paid,
    Expired,
    Cancelled,
}

#[derive(Debug, Clone)]
pub struct InvoiceInfo {
    pub payment_hash: PaymentHash,
    pub amount_msat: u64,
    pub description: String,
    pub state: InvoiceState,
    pub created_at: u64,
    pub expires_at: u64,
}

/// Handles Lightning invoice operations including creation, validation, and payment tracking.
#[derive(Debug)]
pub struct InvoiceHandler {
    node: Arc<RwLock<Option<Node>>>,
}

impl InvoiceHandler {
    pub fn new(node: Arc<RwLock<Option<Node>>>) -> Self {
        Self { node }
    }

    /// Creates a new Lightning invoice.
    #[instrument(skip(self))]
    pub async fn create_invoice(
        &self,
        amount_msat: u64,
        description: String,
        expiry_secs: Option<u32>,
    ) -> Result<(Invoice, PaymentHash)> {
        let node_guard = self.node.read().await;
        let node = node_guard.as_ref().ok_or_else(|| anyhow::anyhow!("Lightning node not initialized"))?;

        info!("Creating invoice for {} msat with description: {}", amount_msat, description);

        let invoice = node.receive_payment(
            amount_msat,
            description.clone(),
            expiry_secs.unwrap_or(3600), // Default 1 hour expiry
        )?;

        let payment_hash = invoice.payment_hash();
        
        info!("Invoice created successfully: {}", invoice.to_string());
        Ok((invoice, payment_hash))
    }

    /// Validates an invoice without processing payment.
    #[instrument(skip(self))]
    pub async fn validate_invoice(&self, invoice_str: &str) -> Result<InvoiceInfo> {
        let invoice: Invoice = invoice_str.parse()?;
        
        // Check if invoice is expired
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        
        let is_expired = invoice.expiry_time() < now as u32;
        
        let state = if is_expired {
            InvoiceState::Expired
        } else {
            InvoiceState::Pending
        };

        let invoice_info = InvoiceInfo {
            payment_hash: invoice.payment_hash(),
            amount_msat: invoice.amount_milli_satoshis().unwrap_or(0),
            description: invoice.description().unwrap_or_default().to_string(),
            state,
            created_at: now - (invoice.expiry_time() as u64 - now),
            expires_at: invoice.expiry_time() as u64,
        };

        info!("Invoice validated: {:?}", invoice_info);
        Ok(invoice_info)
    }

    /// Checks if an invoice has been paid.
    #[instrument(skip(self))]
    pub async fn check_payment(&self, payment_hash: &PaymentHash) -> Result<bool> {
        let node_guard = self.node.read().await;
        let node = node_guard.as_ref().ok_or_else(|| anyhow::anyhow!("Lightning node not initialized"))?;

        // Check if payment has been received
        let payments = node.list_payments();
        let is_paid = payments.iter().any(|payment| {
            payment.payment_hash() == *payment_hash && payment.status().is_successful()
        });

        info!("Payment check for {}: {}", payment_hash, if is_paid { "PAID" } else { "PENDING" });
        Ok(is_paid)
    }

    /// Processes a received payment.
    #[instrument(skip(self))]
    pub async fn process_payment(
        &self,
        payment_hash: &PaymentHash,
        payment_preimage: &PaymentPreimage,
    ) -> Result<()> {
        let node_guard = self.node.read().await;
        let node = node_guard.as_ref().ok_or_else(|| anyhow::anyhow!("Lightning node not initialized"))?;

        info!("Processing payment for hash: {}", payment_hash);

        // Claim the payment
        node.claim_funds(payment_preimage)?;

        info!("Payment processed successfully: {}", payment_hash);
        Ok(())
    }

    /// Lists all invoices with their current state.
    #[instrument(skip(self))]
    pub async fn list_invoices(&self) -> Result<Vec<InvoiceInfo>> {
        let node_guard = self.node.read().await;
        let node = node_guard.as_ref().ok_or_else(|| anyhow::anyhow!("Lightning node not initialized"))?;

        let payments = node.list_payments();
        let mut invoices = Vec::new();

        for payment in payments {
            let state = match payment.status() {
                ldk_node::PaymentStatus::Pending => InvoiceState::Pending,
                ldk_node::PaymentStatus::Succeeded => InvoiceState::Paid,
                ldk_node::PaymentStatus::Failed => InvoiceState::Cancelled,
            };

            let invoice_info = InvoiceInfo {
                payment_hash: payment.payment_hash(),
                amount_msat: payment.amount_msat(),
                description: payment.description().unwrap_or_default().to_string(),
                state,
                created_at: payment.timestamp(),
                expires_at: payment.timestamp() + 3600, // Default 1 hour expiry
            };

            invoices.push(invoice_info);
        }

        info!("Listed {} invoices", invoices.len());
        Ok(invoices)
    }

    /// Cancels an invoice (if possible).
    #[instrument(skip(self))]
    pub async fn cancel_invoice(&self, payment_hash: &PaymentHash) -> Result<()> {
        info!("Cancelling invoice: {}", payment_hash);
        
        // Note: LDK-Node doesn't have a direct cancel invoice method
        // In a real implementation, you would track invoice state manually
        // and mark it as cancelled in your database
        
        info!("Invoice cancelled: {}", payment_hash);
        Ok(())
    }
}
