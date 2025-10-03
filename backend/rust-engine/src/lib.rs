pub mod proto {
    pub mod satsconnect {
        pub mod wallet {
            pub mod v1 {
                include!("proto/satsconnect.wallet.v1.rs");
            }
        }
        pub mod payment {
            pub mod v1 {
                include!("proto/satsconnect.payment.v1.rs");
            }
        }
    }
}

pub mod ai;
pub mod bitcoin_client;
pub mod config;
pub mod lightning;
pub mod lightning_engine;
pub mod lsp;
pub mod monitoring;
pub mod multi_currency;
pub mod notifications;
pub mod payment;
pub mod performance;
pub mod privacy;
pub mod secure_storage;
pub mod security;
pub mod wallet;

#[cfg(test)]
mod tests {
    use crate::payment::PaymentHandler;
    use crate::secure_storage::SecureStorage;
    use crate::wallet::WalletHandler;

    #[tokio::test]
    async fn test_wallet_creation() {
        let wallet_handler = WalletHandler::new().unwrap();

        // Test wallet creation with generated mnemonic
        let result = wallet_handler
            .create_wallet("test-wallet".to_string(), None)
            .await;
        assert!(result.is_ok());

        let (node_id, address) = result.unwrap();
        assert!(!node_id.is_empty());
        assert!(!address.is_empty());
        assert!(address.starts_with("tb1q"));
    }

    #[tokio::test]
    async fn test_wallet_balance() {
        let wallet_handler = WalletHandler::new().unwrap();

        // Create a wallet first
        wallet_handler
            .create_wallet("test-wallet".to_string(), None)
            .await
            .unwrap();

        // Test balance retrieval
        let result = wallet_handler.get_balance().await;
        assert!(result.is_ok());

        let (confirmed_sats, lightning_sats) = result.unwrap();
        // Real Lightning engine will return actual balances
        assert!(confirmed_sats >= 0);
        assert!(lightning_sats >= 0);
    }

    #[tokio::test]
    async fn test_invoice_generation() {
        let wallet_handler = WalletHandler::new().unwrap();

        // Create a wallet first
        wallet_handler
            .create_wallet("test-wallet".to_string(), None)
            .await
            .unwrap();

        // Test invoice generation
        let result = wallet_handler
            .generate_invoice(1000, "Test invoice".to_string())
            .await;
        assert!(result.is_ok());

        let (invoice, payment_hash) = result.unwrap();
        assert!(invoice.starts_with("lnbc"));
        assert!(!payment_hash.is_empty());
    }

    #[tokio::test]
    async fn test_payment_processing() {
        let payment_handler = PaymentHandler::new();

        // Test payment processing
        let result = payment_handler
            .process_payment(
                Some("test_payment_123".to_string()),
                "test_wallet".to_string(),
                1000,
                "lnbc1000u1p3k2v5cpp5test".to_string(),
                "Test payment".to_string(),
            )
            .await;

        assert!(result.is_ok());

        let payment = result.unwrap();
        assert_eq!(payment.payment_id, "test_payment_123");
        assert_eq!(payment.status, "PENDING");
        assert_eq!(payment.amount_sats, 1000);
    }

    #[tokio::test]
    async fn test_secure_storage() {
        let temp_dir = std::env::temp_dir().join("satsconnect_test");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let storage = SecureStorage::new(temp_dir.clone()).unwrap();

        // Test storing and retrieving mnemonic
        let test_mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let wallet_id = "test_wallet_123";

        // Store mnemonic
        let store_result = storage.store_mnemonic(wallet_id, test_mnemonic);
        assert!(store_result.is_ok());

        // Retrieve mnemonic
        let retrieve_result = storage.load_mnemonic(wallet_id);
        assert!(retrieve_result.is_ok());
        assert_eq!(retrieve_result.unwrap(), Some(test_mnemonic.to_string()));

        // Clean up
        std::fs::remove_dir_all(&temp_dir).unwrap();
    }
}
