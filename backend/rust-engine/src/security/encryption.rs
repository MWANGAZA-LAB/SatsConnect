use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionKey {
    pub key_id: String,
    pub key_data: Vec<u8>,
    pub algorithm: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionResult {
    pub encrypted_data: Vec<u8>,
    pub key_id: String,
    pub algorithm: String,
    pub iv: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptionResult {
    pub decrypted_data: Vec<u8>,
    pub key_id: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EncryptionAlgorithm {
    AES256GCM,
    AES256CBC,
    ChaCha20Poly1305,
}

impl EncryptionAlgorithm {
    pub fn as_str(&self) -> &'static str {
        match self {
            EncryptionAlgorithm::AES256GCM => "AES-256-GCM",
            EncryptionAlgorithm::AES256CBC => "AES-256-CBC",
            EncryptionAlgorithm::ChaCha20Poly1305 => "ChaCha20-Poly1305",
        }
    }
}

/// Encryption service for managing data encryption and decryption
#[derive(Debug)]
pub struct EncryptionService {
    keys: HashMap<String, EncryptionKey>,
    default_algorithm: EncryptionAlgorithm,
}

impl EncryptionService {
    pub fn new(default_algorithm: EncryptionAlgorithm) -> Self {
        Self {
            keys: HashMap::new(),
            default_algorithm,
        }
    }

    pub fn generate_key(
        &mut self,
        key_id: String,
        algorithm: Option<EncryptionAlgorithm>,
    ) -> Result<()> {
        let algorithm = algorithm.unwrap_or_else(|| self.default_algorithm.clone());
        let key_data = self.generate_key_data(&algorithm)?;

        let key = EncryptionKey {
            key_id: key_id.clone(),
            key_data,
            algorithm: algorithm.as_str().to_string(),
            created_at: chrono::Utc::now(),
            expires_at: None,
        };

        self.keys.insert(key_id, key);
        info!("Generated encryption key: {}", key_id);
        Ok(())
    }

    pub fn encrypt_data(
        &self,
        data: &[u8],
        key_id: &str,
        algorithm: Option<EncryptionAlgorithm>,
    ) -> Result<EncryptionResult> {
        let key = self
            .keys
            .get(key_id)
            .ok_or_else(|| anyhow::anyhow!("Key not found: {}", key_id))?;

        let algorithm = algorithm.unwrap_or_else(|| self.default_algorithm.clone());
        let iv = self.generate_iv(&algorithm)?;

        let encrypted_data = self.encrypt_with_algorithm(data, &key.key_data, &iv, &algorithm)?;

        Ok(EncryptionResult {
            encrypted_data,
            key_id: key_id.to_string(),
            algorithm: algorithm.as_str().to_string(),
            iv,
        })
    }

    pub fn decrypt_data(&self, encrypted_result: &EncryptionResult) -> Result<DecryptionResult> {
        let key = self
            .keys
            .get(&encrypted_result.key_id)
            .ok_or_else(|| anyhow::anyhow!("Key not found: {}", encrypted_result.key_id))?;

        let algorithm = match encrypted_result.algorithm.as_str() {
            "AES-256-GCM" => EncryptionAlgorithm::AES256GCM,
            "AES-256-CBC" => EncryptionAlgorithm::AES256CBC,
            "ChaCha20-Poly1305" => EncryptionAlgorithm::ChaCha20Poly1305,
            _ => {
                return Err(anyhow::anyhow!(
                    "Unsupported algorithm: {}",
                    encrypted_result.algorithm
                ))
            }
        };

        let decrypted_data = self.decrypt_with_algorithm(
            &encrypted_result.encrypted_data,
            &key.key_data,
            &encrypted_result.iv,
            &algorithm,
        )?;

        Ok(DecryptionResult {
            decrypted_data,
            key_id: encrypted_result.key_id.clone(),
            algorithm: encrypted_result.algorithm.clone(),
        })
    }

    pub fn rotate_key(&mut self, key_id: &str) -> Result<()> {
        if let Some(key) = self.keys.get_mut(key_id) {
            let new_key_data = self.generate_key_data(&self.default_algorithm)?;
            key.key_data = new_key_data;
            key.created_at = chrono::Utc::now();
            info!("Rotated encryption key: {}", key_id);
        } else {
            return Err(anyhow::anyhow!("Key not found: {}", key_id));
        }
        Ok(())
    }

    pub fn revoke_key(&mut self, key_id: &str) -> Result<()> {
        if self.keys.remove(key_id).is_some() {
            info!("Revoked encryption key: {}", key_id);
        } else {
            return Err(anyhow::anyhow!("Key not found: {}", key_id));
        }
        Ok(())
    }

    pub fn list_keys(&self) -> Vec<&EncryptionKey> {
        self.keys.values().collect()
    }

    pub fn get_key(&self, key_id: &str) -> Option<&EncryptionKey> {
        self.keys.get(key_id)
    }

    fn generate_key_data(&self, algorithm: &EncryptionAlgorithm) -> Result<Vec<u8>> {
        match algorithm {
            EncryptionAlgorithm::AES256GCM => {
                // Generate 32-byte key for AES-256
                Ok((0..32).map(|_| rand::random::<u8>()).collect())
            }
            EncryptionAlgorithm::AES256CBC => {
                // Generate 32-byte key for AES-256
                Ok((0..32).map(|_| rand::random::<u8>()).collect())
            }
            EncryptionAlgorithm::ChaCha20Poly1305 => {
                // Generate 32-byte key for ChaCha20
                Ok((0..32).map(|_| rand::random::<u8>()).collect())
            }
        }
    }

    fn generate_iv(&self, algorithm: &EncryptionAlgorithm) -> Result<Vec<u8>> {
        match algorithm {
            EncryptionAlgorithm::AES256GCM => {
                // Generate 12-byte IV for AES-256-GCM
                Ok((0..12).map(|_| rand::random::<u8>()).collect())
            }
            EncryptionAlgorithm::AES256CBC => {
                // Generate 16-byte IV for AES-256-CBC
                Ok((0..16).map(|_| rand::random::<u8>()).collect())
            }
            EncryptionAlgorithm::ChaCha20Poly1305 => {
                // Generate 12-byte nonce for ChaCha20-Poly1305
                Ok((0..12).map(|_| rand::random::<u8>()).collect())
            }
        }
    }

    fn encrypt_with_algorithm(
        &self,
        data: &[u8],
        key: &[u8],
        iv: &[u8],
        algorithm: &EncryptionAlgorithm,
    ) -> Result<Vec<u8>> {
        match algorithm {
            EncryptionAlgorithm::AES256GCM => {
                // In a real implementation, use proper AES-256-GCM encryption
                // For now, just return the data with a prefix
                let mut encrypted = vec![0x01]; // Prefix to indicate encryption
                encrypted.extend_from_slice(data);
                Ok(encrypted)
            }
            EncryptionAlgorithm::AES256CBC => {
                // In a real implementation, use proper AES-256-CBC encryption
                let mut encrypted = vec![0x02]; // Prefix to indicate encryption
                encrypted.extend_from_slice(data);
                Ok(encrypted)
            }
            EncryptionAlgorithm::ChaCha20Poly1305 => {
                // In a real implementation, use proper ChaCha20-Poly1305 encryption
                let mut encrypted = vec![0x03]; // Prefix to indicate encryption
                encrypted.extend_from_slice(data);
                Ok(encrypted)
            }
        }
    }

    fn decrypt_with_algorithm(
        &self,
        encrypted_data: &[u8],
        key: &[u8],
        iv: &[u8],
        algorithm: &EncryptionAlgorithm,
    ) -> Result<Vec<u8>> {
        if encrypted_data.is_empty() {
            return Err(anyhow::anyhow!("Empty encrypted data"));
        }

        match algorithm {
            EncryptionAlgorithm::AES256GCM => {
                if encrypted_data[0] != 0x01 {
                    return Err(anyhow::anyhow!("Invalid encryption format"));
                }
                Ok(encrypted_data[1..].to_vec())
            }
            EncryptionAlgorithm::AES256CBC => {
                if encrypted_data[0] != 0x02 {
                    return Err(anyhow::anyhow!("Invalid encryption format"));
                }
                Ok(encrypted_data[1..].to_vec())
            }
            EncryptionAlgorithm::ChaCha20Poly1305 => {
                if encrypted_data[0] != 0x03 {
                    return Err(anyhow::anyhow!("Invalid encryption format"));
                }
                Ok(encrypted_data[1..].to_vec())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_service_creation() {
        let service = EncryptionService::new(EncryptionAlgorithm::AES256GCM);
        assert_eq!(service.keys.len(), 0);
    }

    #[test]
    fn test_key_generation() {
        let mut service = EncryptionService::new(EncryptionAlgorithm::AES256GCM);
        let result = service.generate_key("test_key".to_string(), None);
        assert!(result.is_ok());
        assert!(service.get_key("test_key").is_some());
    }

    #[test]
    fn test_encryption_decryption() {
        let mut service = EncryptionService::new(EncryptionAlgorithm::AES256GCM);
        service.generate_key("test_key".to_string(), None).unwrap();

        let data = b"Hello, World!";
        let encrypted = service.encrypt_data(data, "test_key", None).unwrap();
        let decrypted = service.decrypt_data(&encrypted).unwrap();

        assert_eq!(decrypted.decrypted_data, data);
    }

    #[test]
    fn test_key_rotation() {
        let mut service = EncryptionService::new(EncryptionAlgorithm::AES256GCM);
        service.generate_key("test_key".to_string(), None).unwrap();

        let original_key = service.get_key("test_key").unwrap().key_data.clone();
        service.rotate_key("test_key").unwrap();
        let rotated_key = service.get_key("test_key").unwrap().key_data.clone();

        assert_ne!(original_key, rotated_key);
    }
}
