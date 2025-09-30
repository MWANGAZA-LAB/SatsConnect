use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use anyhow::Result;
use argon2::password_hash::{rand_core::OsRng, SaltString};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use base64::{engine::general_purpose, Engine as _};
use rand::Rng;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

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

    fn derive_key(data_dir: &std::path::Path) -> Result<[u8; 32]> {
        // Use Argon2 for secure key derivation
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();

        // Create password from data directory path and additional entropy
        let password = format!(
            "{}{}",
            data_dir.to_string_lossy(),
            "satsconnect_secret_salt"
        );

        // Hash the password
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| anyhow::anyhow!("Key derivation failed: {}", e))?;

        // Extract the hash bytes
        let hash_bytes = password_hash.hash.unwrap().as_bytes();

        // Ensure we have exactly 32 bytes
        let mut key = [0u8; 32];
        let copy_len = std::cmp::min(32, hash_bytes.len());
        key[..copy_len].copy_from_slice(&hash_bytes[..copy_len]);

        // If the hash is shorter than 32 bytes, extend it
        if copy_len < 32 {
            let mut hasher = Sha256::new();
            hasher.update(&key[..copy_len]);
            hasher.update(b"additional_entropy");
            let extended_hash = hasher.finalize();
            key[copy_len..].copy_from_slice(&extended_hash[..32 - copy_len]);
        }

        Ok(key)
    }

    fn encrypt_data(&self, data: &str) -> Result<String> {
        let cipher = Aes256Gcm::new(&self.encryption_key.into());
        let nonce_bytes: [u8; 12] = rand::thread_rng().gen();
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, data.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Combine nonce and ciphertext
        let mut encrypted = nonce_bytes.to_vec();
        encrypted.extend_from_slice(&ciphertext);

        Ok(general_purpose::STANDARD.encode(&encrypted))
    }

    fn decrypt_data(&self, encrypted_data: &str) -> Result<String> {
        let encrypted_bytes = general_purpose::STANDARD
            .decode(encrypted_data)
            .map_err(|e| anyhow::anyhow!("Base64 decode failed: {}", e))?;

        if encrypted_bytes.len() < 12 {
            return Err(anyhow::anyhow!("Invalid encrypted data length"));
        }

        let (nonce_bytes, ciphertext) = encrypted_bytes.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let cipher = Aes256Gcm::new(&self.encryption_key.into());
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        String::from_utf8(plaintext).map_err(|e| anyhow::anyhow!("UTF-8 decode failed: {}", e))
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
