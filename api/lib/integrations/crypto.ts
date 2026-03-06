import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;

function getHexKey(): Buffer {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('API_KEY_ENCRYPTION_KEY must be a 64-char hex string');
  }
  return Buffer.from(ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-CBC.
 * Returns format: ivHex:encryptedHex
 */
export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', getHexKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string (format: ivHex:encryptedHex) using AES-256-CBC.
 */
export function decrypt(encrypted: string): string {
  const [ivHex, encryptedHex] = encrypted.split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted token format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', getHexKey(), iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
