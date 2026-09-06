import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export function supportEmailForSlug(slug: string): string {
  const safe = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `support+${safe || 'clinic'}@hislite.support`;
}

export function generateSupportPassword(): string {
  return `Sup@${randomBytes(10).toString('base64url')}`;
}

function vaultKey(): Buffer {
  const raw =
    process.env.SUPPORT_VAULT_KEY ||
    process.env.JWT_SECRET ||
    'dev-only-support-vault-key';
  return createHash('sha256').update(raw).digest();
}

/** Returns opaque `v1.iv.tag.ciphertext` (base64url parts). */
export function encryptSupportPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    enc.toString('base64url'),
  ].join('.');
}

export function decryptSupportPassword(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid support password vault payload');
  }
  const [, ivB, tagB, dataB] = parts;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    vaultKey(),
    Buffer.from(ivB, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB, 'base64url')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}
