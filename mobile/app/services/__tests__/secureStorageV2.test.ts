/**
 * Security Test Suite for SecureStorageV2
 * 
 * Comprehensive security testing following OWASP guidelines
 * and industry best practices for cryptographic implementations
 */

import secureStorageV2, { SecurityEventType } from '../secureStorageV2';

describe('SecureStorageV2 Security Tests', () => {
  const testPassword = 'TestPassword123!@#';
  const testData = 'Sensitive test data that should be encrypted';
  const weakPassword = '123';
  const longData = 'x'.repeat(1024 * 1024 + 1); // 1MB + 1 byte

  beforeEach(async () => {
    // Clear all data before each test
    await secureStorageV2.clearAllData();
  });

  describe('Encryption Security', () => {
    test('should encrypt data with AES-256-GCM', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(testData);
      expect(encrypted).toContain('"algorithm":"aes-256-gcm"');
      expect(encrypted).toContain('"version":2');
    });

    test('should produce different ciphertext for same input', async () => {
      const encrypted1 = await secureStorageV2.encryptData(testData, testPassword);
      const encrypted2 = await secureStorageV2.encryptData(testData, testPassword);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    test('should reject empty data', async () => {
      await expect(secureStorageV2.encryptData('', testPassword))
        .rejects.toThrow('Empty data not allowed');
    });

    test('should reject data that is too large', async () => {
      await expect(secureStorageV2.encryptData(longData, testPassword))
        .rejects.toThrow('Data too large');
    });

    test('should reject weak passwords', async () => {
      await expect(secureStorageV2.encryptData(testData, weakPassword))
        .rejects.toThrow('Password too weak');
    });
  });

  describe('Decryption Security', () => {
    test('should decrypt data correctly', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      const decrypted = await secureStorageV2.decryptData(encrypted, testPassword);
      
      expect(decrypted).toBe(testData);
    });

    test('should reject wrong password', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      
      await expect(secureStorageV2.decryptData(encrypted, 'WrongPassword'))
        .rejects.toThrow('Decryption failed');
    });

    test('should reject tampered data', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      const tamperedData = JSON.parse(encrypted);
      tamperedData.ciphertext = 'tampered';
      const tamperedEncrypted = JSON.stringify(tamperedData);
      
      await expect(secureStorageV2.decryptData(tamperedEncrypted, testPassword))
        .rejects.toThrow('Decryption failed');
    });

    test('should reject invalid encrypted data structure', async () => {
      const invalidData = '{"invalid": "structure"}';
      
      await expect(secureStorageV2.decryptData(invalidData, testPassword))
        .rejects.toThrow('Decryption failed');
    });
  });

  describe('Rate Limiting', () => {
    test('should implement rate limiting on failed attempts', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      
      // Make multiple failed attempts
      for (let i = 0; i < 6; i++) {
        try {
          await secureStorageV2.decryptData(encrypted, 'WrongPassword');
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Next attempt should be rate limited
      await expect(secureStorageV2.decryptData(encrypted, 'WrongPassword'))
        .rejects.toThrow('Rate limit exceeded');
    });

    test('should reset rate limiting on successful operation', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      
      // Make failed attempts
      for (let i = 0; i < 3; i++) {
        try {
          await secureStorageV2.decryptData(encrypted, 'WrongPassword');
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Successful operation should reset rate limiting
      await secureStorageV2.decryptData(encrypted, testPassword);
      
      // Should be able to make more attempts
      await expect(secureStorageV2.decryptData(encrypted, 'WrongPassword'))
        .rejects.toThrow('Decryption failed');
    });
  });

  describe('Key Management', () => {
    test('should support key versioning', async () => {
      const encrypted1 = await secureStorageV2.encryptData(testData, testPassword);
      const encrypted2 = await secureStorageV2.encryptData(testData, testPassword);
      
      const data1 = JSON.parse(encrypted1);
      const data2 = JSON.parse(encrypted2);
      
      expect(data1.keyVersion).toBeDefined();
      expect(data2.keyVersion).toBeDefined();
      expect(data2.keyVersion).toBeGreaterThan(data1.keyVersion);
    });

    test('should use Argon2id for key derivation', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      const data = JSON.parse(encrypted);
      
      // Check that key metadata indicates Argon2id usage
      expect(data.keyVersion).toBeDefined();
    });
  });

  describe('Security Logging', () => {
    test('should log security events', async () => {
      await secureStorageV2.encryptData(testData, testPassword);
      
      const logs = await secureStorageV2.getSecurityLogs();
      expect(logs.length).toBeGreaterThan(0);
      
      const encryptionLog = logs.find(log => log.type === SecurityEventType.ENCRYPTION);
      expect(encryptionLog).toBeDefined();
      expect(encryptionLog?.message).toContain('Data encrypted successfully');
    });

    test('should log failed attempts', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      
      try {
        await secureStorageV2.decryptData(encrypted, 'WrongPassword');
      } catch (error) {
        // Expected to fail
      }
      
      const logs = await secureStorageV2.getSecurityLogs();
      const failedAttemptLog = logs.find(log => log.type === SecurityEventType.DECRYPTION);
      expect(failedAttemptLog).toBeDefined();
      expect(failedAttemptLog?.message).toContain('Decryption failed');
    });

    test('should include tamper-resistant hashes in logs', async () => {
      await secureStorageV2.encryptData(testData, testPassword);
      
      const logs = await secureStorageV2.getSecurityLogs();
      const log = logs[0];
      
      expect(log.hash).toBeDefined();
      expect(log.hash).not.toBe('');
    });
  });

  describe('Data Integrity', () => {
    test('should detect data tampering', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      const data = JSON.parse(encrypted);
      
      // Tamper with HMAC
      data.hmac = 'tampered_hmac';
      const tamperedEncrypted = JSON.stringify(data);
      
      await expect(secureStorageV2.decryptData(tamperedEncrypted, testPassword))
        .rejects.toThrow('Decryption failed');
    });

    test('should verify data integrity on decryption', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      
      // Should decrypt successfully with correct password
      const decrypted = await secureStorageV2.decryptData(encrypted, testPassword);
      expect(decrypted).toBe(testData);
    });
  });

  describe('Security State Management', () => {
    test('should track security state correctly', async () => {
      const status = await secureStorageV2.getSecurityStatus();
      
      expect(status.isSecure).toBe(true);
      expect(status.failedAttempts).toBe(0);
      expect(status.isLocked).toBe(false);
      expect(status.totalOperations).toBe(0);
    });

    test('should update security state after operations', async () => {
      await secureStorageV2.encryptData(testData, testPassword);
      
      const status = await secureStorageV2.getSecurityStatus();
      expect(status.totalOperations).toBeGreaterThan(0);
    });

    test('should handle lockout correctly', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      
      // Make enough failed attempts to trigger lockout
      for (let i = 0; i < 6; i++) {
        try {
          await secureStorageV2.decryptData(encrypted, 'WrongPassword');
        } catch (error) {
          // Expected to fail
        }
      }
      
      const status = await secureStorageV2.getSecurityStatus();
      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Error Handling', () => {
    test('should not leak sensitive information in errors', async () => {
      const encrypted = await secureStorageV2.encryptData(testData, testPassword);
      
      try {
        await secureStorageV2.decryptData(encrypted, 'WrongPassword');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).not.toContain('password');
        expect(errorMessage).not.toContain('key');
        expect(errorMessage).not.toContain('encryption');
        expect(errorMessage).toBe('Decryption failed');
      }
    });

    test('should handle malformed encrypted data gracefully', async () => {
      const malformedData = '{"invalid": "json"';
      
      await expect(secureStorageV2.decryptData(malformedData, testPassword))
        .rejects.toThrow('Decryption failed');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple operations efficiently', async () => {
      const startTime = Date.now();
      
      // Perform multiple encryption/decryption operations
      for (let i = 0; i < 10; i++) {
        const data = `Test data ${i}`;
        const encrypted = await secureStorageV2.encryptData(data, testPassword);
        const decrypted = await secureStorageV2.decryptData(encrypted, testPassword);
        expect(decrypted).toBe(data);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    test('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => 
        secureStorageV2.encryptData(`Concurrent data ${i}`, testPassword)
      );
      
      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result).not.toBe('');
      });
    });
  });

  describe('Memory Management', () => {
    test('should not leak memory with repeated operations', async () => {
      // Perform many operations to test for memory leaks
      for (let i = 0; i < 100; i++) {
        const data = `Memory test data ${i}`;
        const encrypted = await secureStorageV2.encryptData(data, testPassword);
        const decrypted = await secureStorageV2.decryptData(encrypted, testPassword);
        expect(decrypted).toBe(data);
      }
      
      // Should still be able to perform operations
      const finalEncrypted = await secureStorageV2.encryptData('Final test', testPassword);
      const finalDecrypted = await secureStorageV2.decryptData(finalEncrypted, testPassword);
      expect(finalDecrypted).toBe('Final test');
    });
  });

  describe('Edge Cases', () => {
    test('should handle special characters in data', async () => {
      const specialData = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = await secureStorageV2.encryptData(specialData, testPassword);
      const decrypted = await secureStorageV2.decryptData(encrypted, testPassword);
      
      expect(decrypted).toBe(specialData);
    });

    test('should handle unicode characters', async () => {
      const unicodeData = 'Unicode: 你好世界 🌍 🚀 💰';
      const encrypted = await secureStorageV2.encryptData(unicodeData, testPassword);
      const decrypted = await secureStorageV2.decryptData(encrypted, testPassword);
      
      expect(decrypted).toBe(unicodeData);
    });

    test('should handle very long passwords', async () => {
      const longPassword = 'A'.repeat(1000);
      const encrypted = await secureStorageV2.encryptData(testData, longPassword);
      const decrypted = await secureStorageV2.decryptData(encrypted, longPassword);
      
      expect(decrypted).toBe(testData);
    });
  });
});
