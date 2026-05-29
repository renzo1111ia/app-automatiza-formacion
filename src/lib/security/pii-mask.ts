/**
 * PII masking helpers para logs server-side.
 *
 * BUG-SEC-03 (Sprint 3, 29-05-2026): los logs de servidor no deben registrar
 * PII en claro. Cubre OWASP A09:2021 Security Logging & Monitoring Failures
 * y minimiza obligaciones de retención/borrado GDPR.
 *
 * Uso:
 *   import { maskEmail } from "@/lib/security/pii-mask";
 *   console.log(`[AUTH] login para ${maskEmail(email)}`);
 */

/**
 * Enmascara un email para logs.
 *
 * Reglas:
 *   - `juan.perez@dominio.com`   → `jua***@dominio.com`
 *   - `a@b.com`                  → `a***@b.com`
 *   - Sin `@`                    → `***`
 *   - String vacío/null/undefined → `***`
 *   - Termina en `@` (sin dominio) → `***`
 *
 * Mantiene utilidad para debugging (dominio + prefijo) sin exponer el local-part
 * completo. No es reversible — los logs no permiten reconstruir el email.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const prefix = local.slice(0, Math.min(3, local.length));
  return `${prefix}***@${domain}`;
}

/**
 * Enmascara un número de teléfono dejando solo los últimos 3 dígitos.
 *
 * Ejemplos:
 *   - `+34612345678` → `+34******678`
 *   - `612345678`    → `******678`
 *   - String < 4 chars → `***`
 *
 * Útil para logs de WhatsApp / Retell / Ultravox donde el `to` aparece en logs
 * de envío. No revierte el número (solo últimos 3 visibles).
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "***";
  const trimmed = phone.trim();
  if (trimmed.length < 4) return "***";
  const prefix = trimmed.startsWith("+") ? "+" : "";
  const digits = prefix ? trimmed.slice(1) : trimmed;
  if (digits.length < 4) return "***";
  const last = digits.slice(-3);
  const stars = "*".repeat(digits.length - 3);
  return `${prefix}${stars}${last}`;
}
