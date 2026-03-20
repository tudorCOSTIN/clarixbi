import { encryptToString, decryptFromString } from '../../common/utils/encryption';

/**
 * Encrypt a Stripe ID (subscription_id or customer_id) for storage.
 * Returns null if the input is null.
 */
export function encryptStripeId(id: string | null): string | null {
  if (id === null || id === undefined) {
    return null;
  }
  return encryptToString(id);
}

/**
 * Decrypt a stored Stripe ID back to plaintext.
 * Returns null if the input is null.
 * Returns the original value if decryption fails (for backward compatibility
 * with unencrypted data during migration).
 */
export function decryptStripeId(encrypted: string | null): string | null {
  if (encrypted === null || encrypted === undefined) {
    return null;
  }
  try {
    return decryptFromString(encrypted);
  } catch {
    // If decryption fails, the value may still be in plaintext
    // (pre-migration data). Return as-is.
    return encrypted;
  }
}
