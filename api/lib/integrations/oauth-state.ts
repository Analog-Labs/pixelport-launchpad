import { createHmac, timingSafeEqual } from 'crypto';

const STATE_SECRET = process.env.SLACK_STATE_SECRET || process.env.API_KEY_ENCRYPTION_KEY;

function getStateSecret(): string {
  if (!STATE_SECRET) {
    throw new Error('Missing SLACK_STATE_SECRET or API_KEY_ENCRYPTION_KEY for OAuth state signing');
  }
  return STATE_SECRET;
}

/**
 * Generate an HMAC-signed OAuth state parameter.
 *
 * Without PKCE: tenantId.timestamp.signature
 * With PKCE:    tenantId.timestamp.signature|codeVerifier
 *
 * The HMAC covers the full payload including codeVerifier when present,
 * so tampering with any part invalidates the signature.
 *
 * Valid for 10 minutes.
 */
export function generateState(tenantId: string, codeVerifier?: string): string {
  const secret = getStateSecret();
  const timestamp = Date.now().toString(36);

  // Include codeVerifier in the HMAC input so it's tamper-proof
  const hmacInput = codeVerifier
    ? `${tenantId}.${timestamp}.${codeVerifier}`
    : `${tenantId}.${timestamp}`;

  const signature = createHmac('sha256', secret)
    .update(hmacInput)
    .digest('hex')
    .slice(0, 32);

  const base = `${tenantId}.${timestamp}.${signature}`;
  return codeVerifier ? `${base}|${codeVerifier}` : base;
}

export interface VerifiedState {
  tenantId: string;
  codeVerifier?: string;
}

/**
 * Verify an OAuth state parameter.
 * Returns tenantId + optional codeVerifier if valid, null if invalid or expired.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyState(state: string): VerifiedState | null {
  // Split off PKCE code verifier if present
  let statePart = state;
  let codeVerifier: string | undefined;
  if (state.includes('|')) {
    const pipeIdx = state.indexOf('|');
    statePart = state.slice(0, pipeIdx);
    codeVerifier = state.slice(pipeIdx + 1);
  }

  const [tenantId, timestamp, signature] = statePart.split('.');
  if (!tenantId || !timestamp || !signature) return null;

  let secret: string;
  try {
    secret = getStateSecret();
  } catch {
    return null;
  }

  // Recompute HMAC including codeVerifier if present
  const hmacInput = codeVerifier
    ? `${tenantId}.${timestamp}.${codeVerifier}`
    : `${tenantId}.${timestamp}`;

  const expected = createHmac('sha256', secret)
    .update(hmacInput)
    .digest('hex')
    .slice(0, 32);

  // Timing-safe comparison
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const issuedAtMs = Number.parseInt(timestamp, 36);
  if (!Number.isFinite(issuedAtMs)) return null;

  const tenMinutesMs = 10 * 60 * 1000;
  if (Date.now() - issuedAtMs > tenMinutesMs) return null;

  return { tenantId, codeVerifier };
}
