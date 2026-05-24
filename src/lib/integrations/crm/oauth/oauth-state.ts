/**
 * OAuth state token — anti-CSRF + carry `tenantId` durante el flow.
 *
 * Estructura del state: `<tenantId>:<nonce>:<signature>`.
 *   - `signature = HMAC-SHA256(tenantId + ':' + nonce, OAUTH_STATE_SECRET)` en hex.
 *
 * Verificación:
 *   1. Split en 3 partes.
 *   2. Re-calcular signature y comparar en tiempo constante.
 *   3. Comparar `tenantId` con el esperado (server-side al recibir callback).
 *
 * Ref:
 *   plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-03-adapter-pattern.md §4
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const NONCE_BYTES = 16; // 32 chars hex
const HMAC_HEX_LENGTH = 64; // SHA-256 → 32 bytes → 64 hex

function getSecret(): string {
  const raw = process.env.OAUTH_STATE_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "OAUTH_STATE_SECRET missing or too short (<32 chars). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\" and set it in .env.local + Easypanel."
    );
  }
  return raw;
}

/**
 * Genera un state firmado para iniciar el flow OAuth.
 *
 * @param tenantId UUID del tenant que inicia la conexión.
 * @returns string serializado `tenantId:nonce:sig` — pasar al CRM como `state`.
 */
export function generateOAuthState(tenantId: string): string {
  if (!tenantId) throw new Error("generateOAuthState: tenantId requerido");
  const secret = getSecret();
  const nonce = randomBytes(NONCE_BYTES).toString("hex");
  const payload = `${tenantId}:${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

/**
 * Verifica un state recibido en el callback OAuth.
 *
 * @param state String recibido como query param.
 * @param expectedTenantId Tenant que se espera (server lo conoce vía cookie/sesión).
 * @returns `true` solo si: split correcto + tenantId coincide + HMAC válido (constant-time).
 */
export function verifyOAuthState(state: string, expectedTenantId: string): boolean {
  if (!state || !expectedTenantId) return false;
  const parts = state.split(":");
  if (parts.length !== 3) return false;

  const [tenantId, nonce, sig] = parts;
  if (tenantId !== expectedTenantId) return false;
  if (sig.length !== HMAC_HEX_LENGTH) return false;
  if (!/^[0-9a-f]+$/i.test(sig)) return false;

  const secret = getSecret();
  const expected = createHmac("sha256", secret).update(`${tenantId}:${nonce}`).digest("hex");

  // Constant-time comparison para evitar timing attack
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

/** Extrae el `tenantId` de un state validado (caller debe haber llamado `verifyOAuthState` antes). */
export function extractTenantId(state: string): string | null {
  const parts = state.split(":");
  if (parts.length !== 3) return null;
  return parts[0] || null;
}
