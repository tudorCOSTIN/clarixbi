import { encryptStripeId, decryptStripeId } from './billing.utils';

jest.mock('../../common/utils/encryption', () => ({
  encryptToString: jest.fn((val: string) => `encrypted:${val}`),
  decryptFromString: jest.fn((val: string) => {
    if (val.startsWith('encrypted:')) return val.replace('encrypted:', '');
    throw new Error('Decryption failed');
  }),
}));

describe('billing.utils', () => {
  describe('encryptStripeId', () => {
    it('should return null for null input', () => {
      expect(encryptStripeId(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(encryptStripeId(undefined as any)).toBeNull();
    });

    it('should encrypt a valid Stripe ID', () => {
      expect(encryptStripeId('cus_abc123')).toBe('encrypted:cus_abc123');
    });

    it('should encrypt a subscription ID', () => {
      expect(encryptStripeId('sub_xyz789')).toBe('encrypted:sub_xyz789');
    });
  });

  describe('decryptStripeId', () => {
    it('should return null for null input', () => {
      expect(decryptStripeId(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(decryptStripeId(undefined as any)).toBeNull();
    });

    it('should decrypt an encrypted Stripe ID', () => {
      expect(decryptStripeId('encrypted:cus_abc123')).toBe('cus_abc123');
    });

    it('should return the original value if decryption fails (backward compat)', () => {
      // Plain text value that wasn't encrypted (pre-migration data)
      expect(decryptStripeId('cus_plain_text')).toBe('cus_plain_text');
    });
  });

  describe('roundtrip', () => {
    it('should encrypt then decrypt back to original', () => {
      const original = 'cus_roundtrip123';
      const encrypted = encryptStripeId(original);
      expect(encrypted).not.toBeNull();
      const decrypted = decryptStripeId(encrypted!);
      expect(decrypted).toBe(original);
    });
  });
});
