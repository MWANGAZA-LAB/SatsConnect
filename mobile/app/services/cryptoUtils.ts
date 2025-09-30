/**
 * Production-Grade Cryptographic Utilities
 * 
 * WebCrypto API implementation for secure encryption/decryption
 * Follows NIST, OWASP, and IETF standards
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { encode as btoa, decode as atob } from 'base-64';
import argon2 from 'argon2-browser';

// Security constants
const CRYPTO_CONSTANTS = {
  AES_KEY_LENGTH: 256,
  GCM_IV_LENGTH: 12, // 96 bits
  GCM_TAG_LENGTH: 16, // 128 bits
  HMAC_KEY_LENGTH: 256,
  SALT_LENGTH: 32, // 256 bits
  ARGON2_MEMORY: 64 * 1024, // 64 MB in KB
  ARGON2_ITERATIONS: 3,
  ARGON2_PARALLELISM: 1, // Reduced for mobile compatibility
  PBKDF2_ITERATIONS: 100000,
} as const;

// Utility: convert between ArrayBuffer <-> Base64
const bufToBase64 = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

const base64ToBuf = (b64: string): ArrayBuffer =>
  Uint8Array.from(atob(b64), (c: string) => c.charCodeAt(0)).buffer;

/**
 * Generate cryptographically secure random bytes
 */
export async function generateSecureRandom(length: number): Promise<Uint8Array> {
  try {
    const randomBytes = await Crypto.getRandomBytesAsync(length);
    
    // Validate randomness
    if (randomBytes.length !== length) {
      throw new Error('Insufficient random bytes generated');
    }
    
    // Basic entropy check
    const uniqueBytes = new Set(randomBytes);
    if (uniqueBytes.size < length * 0.5) {
      throw new Error('Insufficient entropy in random generation');
    }
    
    return randomBytes;
  } catch (error) {
    throw new Error(`Secure random generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Derive key using Argon2id (preferred) or PBKDF2 (fallback)
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  algorithm: 'argon2id' | 'pbkdf2' = 'argon2id'
): Promise<CryptoKey> {
  try {
    if (algorithm === 'argon2id') {
      return await deriveKeyArgon2id(password, salt);
    } else {
      return await deriveKeyPBKDF2(password, salt);
    }
  } catch (error) {
    throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Derive key using Argon2id
 */
async function deriveKeyArgon2id(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  try {
    const result = await argon2.hash({
      pass: password,
      salt,
      type: argon2.ArgonType.Argon2id,
      time: CRYPTO_CONSTANTS.ARGON2_ITERATIONS,
      mem: CRYPTO_CONSTANTS.ARGON2_MEMORY,
      hashLen: 32,
      parallelism: CRYPTO_CONSTANTS.ARGON2_PARALLELISM,
    });

    return crypto.subtle.importKey(
      "raw",
      result.hash.buffer,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  } catch (error) {
    throw new Error(`Argon2id key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Derive key using PBKDF2-HMAC-SHA256
 */
async function deriveKeyPBKDF2(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  try {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt.buffer,
        iterations: CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  } catch (error) {
    throw new Error(`PBKDF2 key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate HMAC-SHA256 for data integrity
 */
export async function generateHMAC(data: string, key: CryptoKey): Promise<string> {
  try {
    const enc = new TextEncoder();
    const rawKey = await crypto.subtle.exportKey("raw", key);
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sig = await crypto.subtle.sign("HMAC", hmacKey, enc.encode(data));
    return bufToBase64(sig);
  } catch (error) {
    throw new Error(`HMAC generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify HMAC for data integrity
 */
export async function verifyHMAC(data: string, hmac: string, key: CryptoKey): Promise<boolean> {
  try {
    const expectedHMAC = await generateHMAC(data, key);
    return hmac === expectedHMAC;
  } catch (error) {
    return false;
  }
}

/**
 * AES-GCM encryption using WebCrypto API
 */
export async function aesGcmEncrypt(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  try {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertextBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(plaintext)
    );

    return {
      ciphertext: bufToBase64(ciphertextBuf),
      iv: bufToBase64(iv),
    };
  } catch (error) {
    throw new Error(`AES-GCM encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * AES-GCM decryption using WebCrypto API
 */
export async function aesGcmDecrypt(
  key: CryptoKey,
  ciphertext: string,
  iv: string
): Promise<string> {
  try {
    const dec = new TextDecoder();
    const plaintextBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(base64ToBuf(iv)) },
      key,
      base64ToBuf(ciphertext)
    );
    return dec.decode(plaintextBuf);
  } catch (error) {
    throw new Error(`AES-GCM decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


/**
 * Generate a secure salt
 */
export async function generateSalt(): Promise<Uint8Array> {
  return await generateSecureRandom(CRYPTO_CONSTANTS.SALT_LENGTH);
}

/**
 * Generate a secure IV for AES-GCM
 */
export async function generateIV(): Promise<Uint8Array> {
  return await generateSecureRandom(CRYPTO_CONSTANTS.GCM_IV_LENGTH);
}

/**
 * Generate a secure HMAC key
 */
export async function generateHMACKey(): Promise<Uint8Array> {
  return await generateSecureRandom(CRYPTO_CONSTANTS.HMAC_KEY_LENGTH / 8);
}

/**
 * Validate cryptographic inputs
 */
export function validateCryptoInputs(data: string, password: string): void {
  if (!data || data.length === 0) {
    throw new Error('Data cannot be empty');
  }
  
  if (data.length > 1024 * 1024) { // 1 MB limit
    throw new Error('Data too large');
  }
  
  if (!password || password.length < 8) {
    throw new Error('Password too weak (minimum 8 characters)');
  }
  
  if (password.length > 1000) {
    throw new Error('Password too long');
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Secure memory cleanup (zero out sensitive data)
 */
export function secureCleanup(data: Uint8Array): void {
  if (data && data.length > 0) {
    data.fill(0);
  }
}

/**
 * Check if WebCrypto API is available
 */
export function isWebCryptoAvailable(): boolean {
  return typeof window !== 'undefined' && 
         window.crypto && 
         window.crypto.subtle && 
         typeof window.crypto.subtle.encrypt === 'function';
}

/**
 * Get crypto capabilities
 */
export function getCryptoCapabilities(): {
  webCrypto: boolean;
  aesGcm: boolean;
  hmac: boolean;
  random: boolean;
} {
  return {
    webCrypto: isWebCryptoAvailable(),
    aesGcm: isWebCryptoAvailable(),
    hmac: true, // Always available via Expo Crypto
    random: true, // Always available via Expo Crypto
  };
}

/**
 * Save secure item with encryption
 */
export async function saveSecureItem(
  storageKey: string,
  value: string,
  password: string
): Promise<void> {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKeyArgon2id(password, salt);
    const { ciphertext, iv } = await aesGcmEncrypt(key, value);
    const hmac = await generateHMAC(ciphertext, key);

    const payload = JSON.stringify({
      v: 1,
      salt: bufToBase64(salt.buffer),
      iv,
      ct: ciphertext,
      mac: hmac,
    });

    await SecureStore.setItemAsync(storageKey, payload);
  } catch (error) {
    throw new Error(`Secure save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load secure item with decryption
 */
export async function loadSecureItem(
  storageKey: string,
  password: string
): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(storageKey);
    if (!stored) return null;

    const { v, salt, iv, ct, mac } = JSON.parse(stored);

    const key = await deriveKeyArgon2id(password, new Uint8Array(base64ToBuf(salt)));
    const expectedMac = await generateHMAC(ct, key);

    if (mac !== expectedMac) {
      throw new Error("Integrity check failed: HMAC mismatch");
    }

    return await aesGcmDecrypt(key, ct, iv);
  } catch (error) {
    throw new Error(`Secure load failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}