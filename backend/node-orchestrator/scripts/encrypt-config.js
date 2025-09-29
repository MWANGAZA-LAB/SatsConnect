#!/usr/bin/env node

/**
 * Script to encrypt sensitive configuration values
 * Usage: node scripts/encrypt-config.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Simple encryption function for the script
function encryptValue(value, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `encrypted:${iv.toString('hex')}:${encrypted}`;
}

function getOrCreateEncryptionKey() {
  const keyPath = path.join(process.cwd(), '.config.key');
  
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8');
  }

  // Generate new key
  const key = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(keyPath, key, { mode: 0o600 }); // Read/write for owner only
  console.log('✅ Generated new encryption key for secure config');
  return key;
}

function encryptConfig() {
  const envPath = path.join(process.cwd(), '.env');
  const encryptedPath = path.join(process.cwd(), '.env.encrypted');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ No .env file found. Please create one first.');
    process.exit(1);
  }

  const key = getOrCreateEncryptionKey();
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const sensitiveKeys = [
    'JWT_SECRET',
    'MPESA_CONSUMER_SECRET',
    'MPESA_PASSKEY',
    'CHIMONEY_API_KEY',
    'CHIMONEY_SUB_KEY',
    'REDIS_PASSWORD',
  ];

  const lines = envContent.split('\n');
  const encryptedLines = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      const value = valueParts.join('=');
      
      if (sensitiveKeys.includes(key) && value && !value.startsWith('encrypted:')) {
        const encryptedValue = encryptValue(value, key);
        encryptedLines.push(`${key}=${encryptedValue}`);
        console.log(`🔒 Encrypted: ${key}`);
      } else {
        encryptedLines.push(line);
      }
    } else {
      encryptedLines.push(line);
    }
  }

  const encryptedContent = encryptedLines.join('\n');
  fs.writeFileSync(encryptedPath, encryptedContent, { mode: 0o600 });
  
  console.log('✅ Configuration encrypted and saved to .env.encrypted');
  console.log('🔑 Encryption key saved to .config.key');
  console.log('⚠️  Keep .config.key secure and never commit it to version control!');
}

// Run the encryption
encryptConfig();
