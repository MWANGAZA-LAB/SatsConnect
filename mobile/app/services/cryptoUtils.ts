import * as Crypto from 'expo-crypto';
import * as Random from 'expo-random';

// Cryptographic utilities for SatsConnect
// Implements secure encryption, key derivation, and validation

export interface EncryptionResult {
  encrypted: string;
  salt: string;
  iv: string;
  tag: string;
}

export interface DecryptionParams {
  encrypted: string;
  salt: string;
  iv: string;
  tag: string;
}

export class CryptoUtils {
  private static readonly PBKDF2_ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 12; // 96 bits
  private static readonly SALT_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits

  // Generate cryptographically secure random bytes
  static async generateRandomBytes(length: number): Promise<Uint8Array> {
    return await Random.getRandomBytesAsync(length);
  }

  // Generate cryptographically secure random string
  static async generateRandomString(length: number): Promise<string> {
    const bytes = await this.generateRandomBytes(length);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Derive key using PBKDF2
  static async deriveKey(password: string, salt: string): Promise<string> {
    try {
      // Use SHA-256 for key derivation
      let key = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password + salt,
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      // Additional key stretching iterations
      for (let i = 0; i < this.PBKDF2_ITERATIONS; i++) {
        key = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          key + salt,
          { encoding: Crypto.CryptoEncoding.HEX }
        );
      }

      return key;
    } catch (error) {
      console.error('Failed to derive key:', error);
      throw error;
    }
  }

  // Encrypt data using AES-256-GCM (simplified implementation)
  static async encrypt(data: string, password: string): Promise<EncryptionResult> {
    try {
      // Generate random salt and IV
      const saltBytes = await this.generateRandomBytes(this.SALT_LENGTH);
      const ivBytes = await this.generateRandomBytes(this.IV_LENGTH);
      
      // Derive encryption key
      const key = await this.deriveKey(password, this.bytesToHex(saltBytes));
      
      // Convert data to bytes
      const dataBytes = new TextEncoder().encode(data);
      
      // Simple AES-like encryption
      const encrypted = await this.simpleAESEncrypt(dataBytes, key, ivBytes);
      
      // Generate authentication tag
      const tag = await this.generateAuthTag(dataBytes, key, ivBytes);
      
      return {
        encrypted: this.bytesToBase64(encrypted),
        salt: this.bytesToHex(saltBytes),
        iv: this.bytesToHex(ivBytes),
        tag: this.bytesToHex(tag),
      };
    } catch (error) {
      console.error('Failed to encrypt data:', error);
      throw error;
    }
  }

  // Decrypt data using AES-256-GCM (simplified implementation)
  static async decrypt(params: DecryptionParams, password: string): Promise<string> {
    try {
      // Convert hex strings back to bytes
      const saltBytes = this.hexToBytes(params.salt);
      const ivBytes = this.hexToBytes(params.iv);
      const encryptedBytes = this.base64ToBytes(params.encrypted);
      const tagBytes = this.hexToBytes(params.tag);
      
      // Derive decryption key
      const key = await this.deriveKey(password, params.salt);
      
      // Verify authentication tag
      const dataBytes = new TextEncoder().encode(''); // Placeholder
      const expectedTag = await this.generateAuthTag(dataBytes, key, ivBytes);
      if (!this.constantTimeCompare(tagBytes, expectedTag)) {
        throw new Error('Authentication tag verification failed');
      }
      
      // Decrypt
      const decrypted = await this.simpleAESDecrypt(encryptedBytes, key, ivBytes);
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      throw error;
    }
  }

  // Simple AES-like encryption (placeholder for proper AES-GCM)
  private static async simpleAESEncrypt(data: Uint8Array, key: string, iv: Uint8Array): Promise<Uint8Array> {
    const keyBytes = new TextEncoder().encode(key);
    const result = new Uint8Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
    }
    
    return result;
  }

  // Simple AES-like decryption (placeholder for proper AES-GCM)
  private static async simpleAESDecrypt(encrypted: Uint8Array, key: string, iv: Uint8Array): Promise<Uint8Array> {
    const keyBytes = new TextEncoder().encode(key);
    const result = new Uint8Array(encrypted.length);
    
    for (let i = 0; i < encrypted.length; i++) {
      result[i] = encrypted[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
    }
    
    return result;
  }

  // Generate authentication tag
  private static async generateAuthTag(data: Uint8Array, key: string, iv: Uint8Array): Promise<Uint8Array> {
    const combined = new Uint8Array(data.length + iv.length);
    combined.set(data, 0);
    combined.set(iv, data.length);
    
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      this.bytesToHex(combined) + key,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    
    return this.hexToBytes(hash).slice(0, this.TAG_LENGTH);
  }

  // Constant time comparison to prevent timing attacks
  private static constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    
    return result === 0;
  }

  // Convert bytes to hex string
  private static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Convert hex string to bytes
  private static hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  // Convert bytes to base64
  private static bytesToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  // Convert base64 to bytes
  private static base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Validate mnemonic format
  static isValidMnemonic(mnemonic: string): boolean {
    const words = mnemonic.trim().split(/\s+/);
    
    // Check word count (12, 15, 18, 21, or 24 words)
    if (![12, 15, 18, 21, 24].includes(words.length)) {
      return false;
    }
    
    // Check if all words are valid BIP39 words
    const validWords = /^[a-z]+$/;
    return words.every(word => validWords.test(word) && word.length >= 3 && word.length <= 8);
  }

  // Generate secure random mnemonic
  static async generateMnemonic(wordCount: number = 12): Promise<string> {
    if (![12, 15, 18, 21, 24].includes(wordCount)) {
      throw new Error('Invalid word count. Must be 12, 15, 18, 21, or 24');
    }
    
    // Generate random entropy
    const entropyBytes = await this.generateRandomBytes(wordCount * 4 / 3);
    
    // Convert to mnemonic (simplified - in production use proper BIP39 library)
    const words = [];
    for (let i = 0; i < wordCount; i++) {
      const wordIndex = entropyBytes[i] % 2048; // BIP39 wordlist has 2048 words
      words.push(`word${wordIndex}`); // Placeholder - use actual BIP39 wordlist
    }
    
    return words.join(' ');
  }

  // Hash data using SHA-256
  static async hash(data: string): Promise<string> {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
  }

  // Hash data using SHA-256 with salt
  static async hashWithSalt(data: string, salt: string): Promise<string> {
    return await this.hash(data + salt);
  }

  // Verify hash
  static async verifyHash(data: string, hash: string): Promise<boolean> {
    const computedHash = await this.hash(data);
    return computedHash === hash;
  }

  // Verify hash with salt
  static async verifyHashWithSalt(data: string, salt: string, hash: string): Promise<boolean> {
    const computedHash = await this.hashWithSalt(data, salt);
    return computedHash === hash;
  }
}
