pub mod hsm_integration;
pub mod biometric_auth;
pub mod hardware_wallet;
pub mod secure_enclave;

pub use hsm_integration::{HSMClient, HSMConfig, HSMKey};
pub use biometric_auth::{BiometricAuth, BiometricType, BiometricResult};
pub use hardware_wallet::{HardwareWallet, WalletType, HardwareWalletClient};
pub use secure_enclave::{SecureEnclave, EnclaveKey, EnclaveOperation};
