import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export interface EncryptedData {
  iv: string;
  encrypted: string;
  tag: string;
}

function getEncryptionKey(): Buffer {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(plaintext: string, keyOverride?: Buffer): EncryptedData {
  const key = keyOverride || getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    encrypted,
    tag: tag.toString('hex'),
  };
}

export function decrypt(encryptedData: EncryptedData, keyOverride?: Buffer): string {
  const key = keyOverride || getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const tag = Buffer.from(encryptedData.tag, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function encryptToString(plaintext: string, keyOverride?: Buffer): string {
  const data = encrypt(plaintext, keyOverride);
  return JSON.stringify(data);
}

export function decryptFromString(encryptedString: string, keyOverride?: Buffer): string {
  const data: EncryptedData = JSON.parse(encryptedString);
  return decrypt(data, keyOverride);
}
