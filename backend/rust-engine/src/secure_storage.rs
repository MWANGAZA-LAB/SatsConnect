use anyhow::Result;
use aes_gcm::{Aes256Gcm, Nonce, KeyInit};
use aes_gcm::aead::Aead;
use base64::{Engine as _, engine::general_purpose};
use rand::Rng;
use sha2::{Sha256, Digest};
use std::fs;
use std::path::PathBuf;

#[derive(Debug)]
pub struct SecureStorage {
    data_dir: PathBuf,
    encryption_key: [u8; 32],
}

impl SecureStorage {
    pub fn new(data_dir: PathBuf) -> Result<Self> {
        let encryption_key = Self::derive_key(&data_dir)?;
        Ok(Self {
            data_dir,
            encryption_key,
        })
    }

    fn derive_key(data_dir: &PathBuf) -> Result<[u8; 32]> {
        // In production, this should use a proper key derivation function
        // For now, we'll derive from the data directory path
        let mut hasher = Sha256::new();
        hasher.update(data_dir.to_string_lossy().as_bytes());
        hasher.update(b"satsconnect_secret_salt");
        let hash = hasher.finalize();
        
        let mut key = [0u8; 32];
        key.copy_from_slice(&hash);
        Ok(key)
    }

    fn encrypt_data(&self, data: &str) -> Result<String> {
        let cipher = Aes256Gcm::new(&self.encryption_key.into());
        let nonce_bytes: [u8; 12] = rand::thread_rng().gen();
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = cipher.encrypt(nonce, data.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;
        
        // Combine nonce and ciphertext
        let mut encrypted = nonce_bytes.to_vec();
        encrypted.extend_from_slice(&ciphertext);
        
        Ok(general_purpose::STANDARD.encode(&encrypted))
    }

    fn decrypt_data(&self, encrypted_data: &str) -> Result<String> {
        let encrypted_bytes = general_purpose::STANDARD.decode(encrypted_data)
            .map_err(|e| anyhow::anyhow!("Base64 decode failed: {}", e))?;
        
        if encrypted_bytes.len() < 12 {
            return Err(anyhow::anyhow!("Invalid encrypted data length"));
        }
        
        let (nonce_bytes, ciphertext) = encrypted_bytes.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        
        let cipher = Aes256Gcm::new(&self.encryption_key.into());
        let plaintext = cipher.decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;
        
        String::from_utf8(plaintext)
            .map_err(|e| anyhow::anyhow!("UTF-8 decode failed: {}", e))
    }

    pub fn store_mnemonic(&self, wallet_id: &str, mnemonic: &str) -> Result<()> {
        let encrypted_mnemonic = self.encrypt_data(mnemonic)?;
        let mnemonic_file = self.data_dir.join(format!("{}.mnemonic", wallet_id));
        
        fs::write(&mnemonic_file, encrypted_mnemonic)?;
        Ok(())
    }

    pub fn load_mnemonic(&self, wallet_id: &str) -> Result<Option<String>> {
        let mnemonic_file = self.data_dir.join(format!("{}.mnemonic", wallet_id));
        
        if !mnemonic_file.exists() {
            return Ok(None);
        }
        
        let encrypted_data = fs::read_to_string(&mnemonic_file)?;
        let mnemonic = self.decrypt_data(&encrypted_data)?;
        Ok(Some(mnemonic))
    }

    pub fn delete_mnemonic(&self, wallet_id: &str) -> Result<()> {
        let mnemonic_file = self.data_dir.join(format!("{}.mnemonic", wallet_id));
        
        if mnemonic_file.exists() {
            fs::remove_file(&mnemonic_file)?;
        }
        
        Ok(())
    }
}
