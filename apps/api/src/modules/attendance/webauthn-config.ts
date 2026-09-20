/** Relying Party config for attendance WebAuthn (no secrets). */
export function webauthnRpId(): string {
  return process.env.WEBAUTHN_RP_ID || process.env.FRONTEND_HOST || 'localhost';
}

export function webauthnRpName(): string {
  return process.env.WEBAUTHN_RP_NAME || 'SPHEAR Attendance';
}

/** Allowed browser origins (comma-separated FRONTEND_URL / WEBAUTHN_ORIGINS). */
export function webauthnOrigins(): string[] {
  const raw =
    process.env.WEBAUTHN_ORIGINS ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
