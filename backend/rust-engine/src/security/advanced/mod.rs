pub mod biometric_auth;
pub mod hardware_wallet;
pub mod hsm_integration;
pub mod secure_enclave;

pub use biometric_auth::{BiometricAuth, BiometricResult, BiometricType};
pub use hardware_wallet::{HardwareWallet, HardwareWalletClient, WalletType};
pub use hsm_integration::{HSMClient, HSMConfig, HSMKey};
pub use secure_enclave::{EnclaveKey, EnclaveOperation, SecureEnclave};
