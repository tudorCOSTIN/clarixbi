import { randomBytes } from 'crypto';
import { encrypt, decrypt, encryptToString, decryptFromString } from './encryption';

describe('Encryption Utils', () => {
  const testKey = randomBytes(32);

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt to original plaintext', () => {
      const plaintext = 'hello world secret data';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same input (random IV)', () => {
      const plaintext = 'test data';
      const a = encrypt(plaintext, testKey);
      const b = encrypt(plaintext, testKey);
      expect(a.encrypted).not.toBe(b.encrypted);
      expect(a.iv).not.toBe(b.iv);
    });

    it('should handle empty string', () => {
      const encrypted = encrypt('', testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe('');
    });

    it('should handle JSON credentials', () => {
      const creds = JSON.stringify({ email: 'test@example.com', token: 'abc123' });
      const encrypted = encrypt(creds, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(JSON.parse(decrypted)).toEqual({ email: 'test@example.com', token: 'abc123' });
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Credentiale SmartBill: parolă secretă 🔑';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should fail with wrong key', () => {
      const plaintext = 'secret';
      const encrypted = encrypt(plaintext, testKey);
      const wrongKey = randomBytes(32);
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it('should fail with tampered data', () => {
      const plaintext = 'secret';
      const encrypted = encrypt(plaintext, testKey);
      encrypted.encrypted = 'tampered' + encrypted.encrypted;
      expect(() => decrypt(encrypted, testKey)).toThrow();
    });
  });

  describe('encryptToString / decryptFromString', () => {
    it('should round-trip through string serialization', () => {
      const plaintext = '{"email":"a@b.com","token":"xyz"}';
      const encStr = encryptToString(plaintext, testKey);
      const decrypted = decryptFromString(encStr, testKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce a valid JSON string', () => {
      const encStr = encryptToString('test', testKey);
      const parsed = JSON.parse(encStr);
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('encrypted');
      expect(parsed).toHaveProperty('tag');
    });

    it('should throw on malformed JSON input in decryptFromString', () => {
      expect(() => decryptFromString('not-valid-json', testKey)).toThrow();
    });

    it('should throw on incomplete JSON object (missing fields)', () => {
      const incomplete = JSON.stringify({ iv: 'abc123' });
      expect(() => decryptFromString(incomplete, testKey)).toThrow();
    });

    it('should throw on empty string input in decryptFromString', () => {
      expect(() => decryptFromString('', testKey)).toThrow();
    });
  });

  describe('ENCRYPTION_KEY env var', () => {
    const originalEnv = process.env['ENCRYPTION_KEY'];

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env['ENCRYPTION_KEY'] = originalEnv;
      } else {
        delete process.env['ENCRYPTION_KEY'];
      }
    });

    it('should throw when ENCRYPTION_KEY is missing and no key override provided', () => {
      delete process.env['ENCRYPTION_KEY'];
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is required');
    });

    it('should throw when ENCRYPTION_KEY is missing for decrypt', () => {
      delete process.env['ENCRYPTION_KEY'];
      const encrypted = encrypt('test', testKey);
      expect(() => decrypt(encrypted)).toThrow('ENCRYPTION_KEY environment variable is required');
    });

    it('should use ENCRYPTION_KEY from env when no override is provided', () => {
      process.env['ENCRYPTION_KEY'] = testKey.toString('hex');
      const encrypted = encrypt('env-key-test');
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe('env-key-test');
    });
  });

  describe('large data handling', () => {
    it('should encrypt and decrypt a 10KB string', () => {
      const largeString = 'A'.repeat(10 * 1024);
      const encrypted = encrypt(largeString, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe(largeString);
      expect(decrypted.length).toBe(10 * 1024);
    });

    it('should round-trip 10KB through string serialization', () => {
      const largeString = 'B'.repeat(10 * 1024);
      const encStr = encryptToString(largeString, testKey);
      const decrypted = decryptFromString(encStr, testKey);
      expect(decrypted).toBe(largeString);
    });
  });
});
