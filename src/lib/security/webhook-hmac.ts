/**
 * HMAC-SHA256 verification helpers para webhooks firmados.
 *
 * BUG-SEC-02 (Sprint 3, 29-05-2026): el endpoint genérico de orchestrator
 * `/api/webhooks/workflow/[workflowId]/[path]/[nodeId]` exige firma cuando el
 * nodo `webhookTrigger` define `data.config.webhook_secret`.
 *
 * Esta función vive aquí (no en el route handler) para poder testearse en
 * unitarios y reusarse en otros webhooks futuros sin duplicar el contrato.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica firma HMAC-SHA256 del raw body en formato `sha256=<hex>` o `<hex>`.
 *
 * Características:
 *   - Usa `timingSafeEqual` para evitar timing attacks.
 *   - Acepta header con o sin prefijo `sha256=` (lower o uppercase).
 *   - Rechaza headers con caracteres fuera de [0-9a-f].
 *   - Rechaza longitudes distintas a la firma esperada (64 hex chars).
 *   - Nunca lanza — devuelve `false` ante cualquier formato inválido.
 *
 * @param rawBody Body crudo del request, exactamente como lo firmó el cliente.
 * @param secret  Secret compartido (string).
 * @param headerValue Valor del header `X-Webhook-Signature` (puede ser null).
 */
export function verifyHmacSignature(
  rawBody: string,
  secret: string,
  headerValue: string | null | undefined
): boolean {
  if (!headerValue) return false;
  if (!secret) return false;
  const value = headerValue.trim().toLowerCase();
  const provided = value.startsWith("sha256=") ? value.slice("sha256=".length) : value;
  if (!/^[0-9a-f]+$/.test(provided)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}
