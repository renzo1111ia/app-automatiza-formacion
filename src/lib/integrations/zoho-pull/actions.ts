"use server";

// Sprint 5 - Server Actions Zoho Pull (entrada de leads event-driven).
//
// Patrón idéntico a src/lib/integrations/sheets/actions.ts:
//   - try/catch → {ok:true,...}|{ok:false,error}
//   - revalidatePath tras mutaciones
//   - Tenant SIEMPRE del usuario autenticado (requireCurrentTenant)
//   - NUNCA aceptar tenant_id del cliente

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { requireCurrentTenant } from "@/lib/integrations/sheets/session";
import { getIntegrationByProvider } from "@/lib/integrations/crm/server-actions";
import { subscribeZohoNotifications, unsubscribeZohoNotifications } from "./subscription";
import { enqueueZohoLeadEvent } from "./queue";
import { suggestFieldMapping } from "./lead-mapper";
import {
  ZohoFieldMappingSchema,
  ZohoSearchCriteriaSchema,
  ZohoSyncConnectionSchema,
} from "./types";
import type { ZohoSyncConnection } from "./types";
import { CRMFactory } from "@/lib/integrations/crm/factory";
import { z } from "zod";

const REVALIDATE_PATH = "/dashboard/settings/integrations/zoho-pull";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errMsg(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
  }
  return err instanceof Error ? err.message : String(err);
}

function buildWebhookUrl(subscriptionToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8500";
  return `${base.replace(/\/$/, "")}/api/webhooks/zoho?token=${encodeURIComponent(subscriptionToken)}`;
}

// ─── getZohoSyncStatusAction ─────────────────────────────────────────────────

export async function getZohoSyncStatusAction(): Promise<
  | {
      ok: true;
      zohoConnected: boolean;
      connection: ZohoSyncConnection | null;
      webhookUrl: string;
    }
  | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");

    if (!integration) {
      return { ok: true, zohoConnected: false, connection: null, webhookUrl: "" };
    }

    const supabase = await getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase
      .from("zoho_sync_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("integration_id", integration.id)
      .maybeSingle();

    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    const connection = row ? (ZohoSyncConnectionSchema.parse(row) as ZohoSyncConnection) : null;
    const token = row?.subscription_token as string | null;
    const webhookUrl = token ? buildWebhookUrl(token) : "";

    return { ok: true, zohoConnected: true, connection, webhookUrl };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── saveZohoSyncConfigAction ─────────────────────────────────────────────────

const SaveZohoSyncConfigSchema = z.object({
  field_mapping: ZohoFieldMappingSchema,
  search_criteria: ZohoSearchCriteriaSchema.optional(),
});

export async function saveZohoSyncConfigAction(
  input: z.infer<typeof SaveZohoSyncConfigSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = SaveZohoSyncConfigSchema.parse(input);
    const { tenantId, userId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");
    if (!integration) throw new Error("Integración Zoho no encontrada para este tenant");

    const supabase = await getAdminSupabaseClient();
    const upsertData = {
      tenant_id: tenantId,
      integration_id: integration.id,
      field_mapping: parsed.field_mapping,
      search_criteria: parsed.search_criteria ?? { module: "Leads" },
      created_by: userId,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("zoho_sync_connections")
      .upsert(upsertData, { onConflict: "tenant_id,integration_id" });

    if (error) throw error;

    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── subscribeZohoNotificationsAction ────────────────────────────────────────

export async function subscribeZohoNotificationsAction(): Promise<
  { ok: true; channelId: string; expiry: string } | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");
    if (!integration) throw new Error("Integración Zoho no encontrada para este tenant");

    // Asegurar que existe la fila en zoho_sync_connections antes de suscribir
    // (subscription.ts actualiza esa fila con los datos del channel).
    const supabase = await getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await supabase
      .from("zoho_sync_connections")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("integration_id", integration.id)
      .maybeSingle();

    if (!existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("zoho_sync_connections").insert({
        tenant_id: tenantId,
        integration_id: integration.id,
        field_mapping: [],
        search_criteria: { module: "Leads" },
        subscription_method: "notifications_api",
        is_active: true,
        writeback_enabled: true,
      });
    }

    const result = await subscribeZohoNotifications(integration.id);
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, channelId: result.channelId, expiry: result.expiry };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── unsubscribeZohoNotificationsAction ──────────────────────────────────────

export async function unsubscribeZohoNotificationsAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");
    if (!integration) throw new Error("Integración Zoho no encontrada para este tenant");

    await unsubscribeZohoNotifications(integration.id);
    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── getZohoWebhookUrlAction ──────────────────────────────────────────────────

export async function getZohoWebhookUrlAction(): Promise<
  { ok: true; webhookUrl: string; token: string } | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");
    if (!integration) throw new Error("Integración Zoho no encontrada para este tenant");

    const supabase = await getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: fetchErr } = await supabase
      .from("zoho_sync_connections")
      .select("id, subscription_token")
      .eq("tenant_id", tenantId)
      .eq("integration_id", integration.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let token = (data as any)?.subscription_token as string | null;

    if (!token) {
      // Generar y persistir token para vía manual (workflow_webhook).
      token = crypto.randomBytes(32).toString("base64url");

      if (!data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conn = supabase.from("zoho_sync_connections") as any;
        const { error: insertErr } = await conn.insert({
          tenant_id: tenantId,
          integration_id: integration.id,
          field_mapping: [],
          search_criteria: { module: "Leads" },
          subscription_token: token,
          subscription_method: "workflow_webhook",
          is_active: true,
          writeback_enabled: true,
        });
        if (insertErr) throw insertErr;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updErr } = await supabase
          .from("zoho_sync_connections")
          .update({ subscription_token: token, subscription_method: "workflow_webhook" })
          .eq("tenant_id", tenantId)
          .eq("integration_id", integration.id);
        if (updErr) throw updErr;
      }

      revalidatePath(REVALIDATE_PATH);
    }

    return { ok: true, webhookUrl: buildWebhookUrl(token), token };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── setManualWebhookModeAction ───────────────────────────────────────────────
// Activa la vía MANUAL (Workflow Webhook): genera/persiste el token si no existe,
// marca subscription_method='workflow_webhook' y cancela cualquier suscripción
// automática activa (son alternativas, no coexisten). Devuelve la URL del webhook.

export async function setManualWebhookModeAction(): Promise<
  { ok: true; webhookUrl: string } | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");
    if (!integration) throw new Error("Integración Zoho no encontrada para este tenant");

    const supabase = await getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await supabase
      .from("zoho_sync_connections")
      .select("id, subscription_token, subscription_channel_id")
      .eq("tenant_id", tenantId)
      .eq("integration_id", integration.id)
      .maybeSingle();

    // Si había suscripción automática activa, cancelarla en Zoho (best-effort).
    if (existing?.subscription_channel_id) {
      try {
        await unsubscribeZohoNotifications(integration.id);
      } catch {
        /* best-effort */
      }
    }

    const token =
      (existing?.subscription_token as string | null) ??
      crypto.randomBytes(32).toString("base64url");

    const payload = {
      tenant_id: tenantId,
      integration_id: integration.id,
      subscription_token: token,
      subscription_method: "workflow_webhook" as const,
      subscription_channel_id: null,
      subscription_expiry: null,
      is_active: true,
    };

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase
        .from("zoho_sync_connections")
        .update(payload)
        .eq("tenant_id", tenantId)
        .eq("integration_id", integration.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("zoho_sync_connections").insert({
        ...payload,
        field_mapping: [],
        search_criteria: { module: "Leads" },
        writeback_enabled: true,
      });
    }

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, webhookUrl: buildWebhookUrl(token) };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── toggleZohoSyncActiveAction ───────────────────────────────────────────────

export async function toggleZohoSyncActiveAction(
  isActive: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");
    if (!integration) throw new Error("Integración Zoho no encontrada para este tenant");

    const supabase = await getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("zoho_sync_connections")
      .update({ is_active: isActive })
      .eq("tenant_id", tenantId)
      .eq("integration_id", integration.id);

    if (error) throw error;
    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── toggleZohoWritebackAction ────────────────────────────────────────────────

export async function toggleZohoWritebackAction(
  enabled: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");
    if (!integration) throw new Error("Integración Zoho no encontrada para este tenant");

    const supabase = await getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("zoho_sync_connections")
      .update({ writeback_enabled: enabled })
      .eq("tenant_id", tenantId)
      .eq("integration_id", integration.id);

    if (error) throw error;
    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── triggerManualZohoPullAction ──────────────────────────────────────────────

export async function triggerManualZohoPullAction(): Promise<
  { ok: true; jobId: string } | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");
    if (!integration) throw new Error("Integración Zoho no encontrada para este tenant");

    const jobId = await enqueueZohoLeadEvent({
      integration_id: integration.id,
      tenant_id: tenantId,
      trigger: "manual",
      triggered_at: new Date().toISOString(),
    });

    return { ok: true, jobId };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── disconnectZohoAction ─────────────────────────────────────────────────────
// Desconexión COMPLETA de Zoho desde la página de entrada de leads:
//   1. Cancela la suscripción Notifications API (best-effort).
//   2. Borra la config de pull (zoho_sync_connections).
//   3. Revoca el token remoto (provider.disconnect, best-effort) + invalida cache.
//   4. Soft-delete de la integración OAuth (is_active=false + limpia credentials),
//      manteniendo la row para el audit histórico (FK crm_write_audit).
// Mismo soft-delete que /api/integrations/manage/[id]/disconnect (Sprint 2).

export async function disconnectZohoAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");
    if (!integration) throw new Error("Integración Zoho no encontrada para este tenant");

    const supabase = await getAdminSupabaseClient();

    // 1. Cancelar suscripción Notifications API (no romper si falla).
    try {
      await unsubscribeZohoNotifications(integration.id);
    } catch {
      // best-effort: si no había suscripción activa o falla el remoto, seguimos.
    }

    // 2. Borrar la config de pull del tenant.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase
      .from("zoho_sync_connections")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("integration_id", integration.id);

    // 3. Revocar token remoto + invalidar cache del provider (best-effort).
    try {
      const provider = await CRMFactory.getProviderForIntegration(integration.id);
      await provider.disconnect();
    } catch {
      // El revoke remoto puede fallar si el token ya es inválido; igualmente
      // limpiamos local en el paso 4.
    }
    CRMFactory.invalidateProvider(integration.id);

    // 4. Soft-delete de la integración OAuth (mantiene row para audit).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("integrations")
      .update({
        is_active: false,
        credentials_cipher: null,
        expires_at: null,
        healthcheck_status: null,
      })
      .eq("id", integration.id)
      .eq("tenant_id", tenantId);

    if (error) throw error;

    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── suggestZohoFieldMappingAction ────────────────────────────────────────────

export async function suggestZohoFieldMappingAction(): Promise<
  | {
      ok: true;
      fieldMapping: z.infer<typeof ZohoFieldMappingSchema>;
      warning?: string;
    }
  | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getIntegrationByProvider(tenantId, "zoho");
    if (!integration) throw new Error("Integración Zoho no encontrada para este tenant");

    try {
      const provider = await CRMFactory.getProviderForIntegration(integration.id);
      // Buscar un lead de ejemplo — filtro amplio, solo 1 resultado.
      const leads = await provider.searchLeads(
        "(Modified_Time:greater_than:2000-01-01T00:00:00+00:00)"
      );

      if (leads.length === 0) {
        return {
          ok: true,
          fieldMapping: [],
          warning:
            "No se encontraron leads en Zoho. Se mostrará un mapeo en blanco para que lo configures manualmente.",
        };
      }

      const fieldMapping = suggestFieldMapping(leads[0]);
      return { ok: true, fieldMapping };
    } catch (providerErr) {
      // Degradación graciosa: OAuth no disponible / sin leads → mapeo vacío con aviso.
      const warnMsg = providerErr instanceof Error ? providerErr.message : String(providerErr);
      return {
        ok: true,
        fieldMapping: [],
        warning: `No se pudo obtener campos de Zoho (${warnMsg.slice(0, 120)}). Configura el mapeo manualmente.`,
      };
    }
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}
