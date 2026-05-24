/**
 * WriteGuard — enforza `write_policy` antes de invocar `provider.updateLead`.
 *
 * Modos:
 *   - `append_only`: skip cualquier campo que YA tenga valor en el CRM (null/""
 *     son writable). NO escribe audit.
 *   - `overwrite_with_audit`: solo permite campos en `allowedOverrideFields[]`;
 *     escribe audit row a `crm_write_audit` (fire-and-forget — un fallo no
 *     bloquea la escritura al CRM).
 *
 * El caller DEBE pasar `currentCRMFields` (resultado de `provider.getLead`)
 * para que el guard pueda comparar viejo vs nuevo. Si llega `undefined` se
 * loguea warning y se trata como `{}` (= permite escribir todo).
 *
 * Ref:
 *   plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-03-adapter-pattern.md §2
 */

import { getAdminSupabaseClient } from "@/lib/supabase/server";

export type WritePolicy = "append_only" | "overwrite_with_audit";

export interface WriteGuardOptions {
  tenantId: string;
  integrationId: string;
  provider: string;
  leadId: string;
  /** Campos que el caller quiere escribir. */
  fields: Record<string, unknown>;
  /** Campos actuales del CRM (resultado de getLead.fields). */
  currentCRMFields?: Record<string, unknown>;
  /** auth.uid() del usuario que dispara el write (server-side validado). */
  actorId: string;
  policy: WritePolicy;
  /** Whitelist de campos permitidos en `overwrite_with_audit`. */
  allowedOverrideFields?: string[];
}

interface AuditRow {
  tenant_id: string;
  integration_id: string;
  provider: string;
  lead_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string;
  write_policy: WritePolicy;
  actor_id: string;
}

/**
 * Aplica la política de escritura. Devuelve sólo los campos SEGUROS de escribir.
 * Si el resultado es `{}`, el caller debería saltar la llamada al CRM.
 */
export async function applyWritePolicy(opts: WriteGuardOptions): Promise<Record<string, unknown>> {
  const current = opts.currentCRMFields;
  if (current === undefined) {
    console.warn(
      `[WriteGuard] currentCRMFields undefined para integration=${opts.integrationId} lead=${opts.leadId}. Asumiendo todo vacío.`
    );
  }
  const currentSafe = current ?? {};

  if (opts.policy === "append_only") {
    return filterAppendOnly(opts.fields, currentSafe);
  }
  if (opts.policy === "overwrite_with_audit") {
    return filterOverwriteWithAudit(opts, currentSafe);
  }
  throw new Error(`WriteGuard: política desconocida '${opts.policy}'`);
}

function isWritable(currentValue: unknown): boolean {
  if (currentValue === null || currentValue === undefined) return true;
  if (typeof currentValue === "string" && currentValue.trim() === "") return true;
  return false;
}

function filterAppendOnly(
  fields: Record<string, unknown>,
  current: Record<string, unknown>
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object") continue; // primitives only en append_only
    if (isWritable(current[key])) safe[key] = value;
  }
  return safe;
}

function filterOverwriteWithAudit(
  opts: WriteGuardOptions,
  current: Record<string, unknown>
): Record<string, unknown> {
  const allowed = new Set(opts.allowedOverrideFields ?? []);
  const safe: Record<string, unknown> = {};
  const auditRows: AuditRow[] = [];

  for (const [key, value] of Object.entries(opts.fields)) {
    if (value === undefined || value === null) continue;
    if (!allowed.has(key)) continue;
    safe[key] = value;
    const oldValue = current[key];
    if (toStringSafe(oldValue) !== toStringSafe(value)) {
      auditRows.push({
        tenant_id: opts.tenantId,
        integration_id: opts.integrationId,
        provider: opts.provider,
        lead_id: opts.leadId,
        field_name: key,
        old_value: oldValue === undefined || oldValue === null ? null : toStringSafe(oldValue),
        new_value: toStringSafe(value),
        write_policy: opts.policy,
        actor_id: opts.actorId,
      });
    }
  }

  if (auditRows.length > 0) {
    // Fire-and-forget — no awaitar para no bloquear el write CRM.
    insertAuditRows(opts.integrationId, opts.leadId, auditRows).catch((err) => {
      console.error(
        `[WriteGuard] audit insert failed integration=${opts.integrationId} lead=${opts.leadId}: ${(err as Error).message}`
      );
    });
  }

  return safe;
}

function toStringSafe(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function insertAuditRows(
  integrationId: string,
  leadId: string,
  rows: AuditRow[]
): Promise<void> {
  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("crm_write_audit" as any) as any).insert(rows);
  if (error) {
    throw new Error(`crm_write_audit insert failed: ${error.message}`);
  }
}
