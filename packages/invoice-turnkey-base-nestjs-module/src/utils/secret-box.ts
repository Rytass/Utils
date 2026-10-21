import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const AUTH_TAG_LENGTH = 16;

/** 以 secretEncryptionKey（SHA-256 後當 AES-256-GCM 金鑰）加密欄位；格式 `v1:<iv>:<tag>:<cipher>`（Base64） */
const deriveKey = (secret: string): Buffer => createHash('sha256').update(secret, 'utf8').digest();

export const sealSecret = (plain: string, secret: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
};

export const openSecret = (sealed: string, secret: string): string => {
  const [version, iv, tag, encrypted] = sealed.split(':');

  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Unsupported sealed secret format');

  const authTag = Buffer.from(tag, 'base64');

  // 只接受完整 16 bytes 的 tag，避免截短 tag 降低驗證強度
  if (authTag.length !== AUTH_TAG_LENGTH) throw new Error('Unsupported sealed secret format');

  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(iv, 'base64'), {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
};
