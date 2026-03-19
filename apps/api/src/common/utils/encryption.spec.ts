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
  });
});
