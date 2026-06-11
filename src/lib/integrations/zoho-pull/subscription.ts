// Sprint 5 - Suscripción Notifications API v8 de Zoho (event-driven).
//
// Nos suscribimos programáticamente a los eventos Leads.create / Leads.edit.
// Zoho POSTea a nuestra notify_url cuando ocurren → el webhook entra al instante.
//
// Endpoint (verificado contra docs v8, context7):
//   - Enable : POST   {api-domain}/crm/v8/actions/watch
//   - Disable: DELETE {api-domain}/crm/v8/actions/watch?channel_ids=<id>
//   - Renew  : re-POST con el MISMO channel_id + nuevo channel_expiry
//   Body enable: { watch: [{ channel_id, events, channel_expiry, token, notify_url }] }
//   - channel_id es numérico (long). token (máx 50 chars) se devuelve en el callback.
//   - channel_expiry máx 1 semana desde ahora (ISO con offset). Si se omite, default 1h.
//   Scope requerido: ZohoCRM.notifications.ALL (o CREATE).
//
// Persistimos channel_id/token/expiry/method='notifications_api' en
// zoho_sync_connections para validar el webhook entrante y renovar luego.

import crypto from "node:crypto";
import { getValidTokens } from "@/lib/integrations/crm/token-manager";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/utils/logger";
import { ZohoPullError } from "./types";

const log = createLogger("zoho-pull.subscription");

const WATCH_EVENTS = ["Leads.create", "Leads.edit"];
const EXPIRY_DAYS = 7;

export interface SubscribeResult {
  channelId: string;
  subscriptionToken: string;
  expiry: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function publicBaseUrl(): string {
  // notify_url DEBE ser una URL pública HTTPS alcanzable por Zoho. En dev se usa
  // un túnel (ngrok). Misma var que Sheets para su notify_url.
  return process.env.NGROK_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8500";
}

function buildExpiryIso(days = EXPIRY_DAYS): string {
  // Zoho Notifications API exige channel_expiry en ISO 8601 con offset numérico
  // explícito (p. ej. 2026-06-18T12:00:00+00:00). `Date.toISOString()` devuelve
  // el sufijo `Z` (Zulu), que Zoho rechaza con INVALID_DATA / expected datetime.
  // Convertimos el `Z` final a `+00:00` (sigue siendo UTC) y quitamos los
  // milisegundos, que Zoho tampoco necesita.
  const iso = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  return iso.replace(/\.\d{3}Z$/, "+00:00");
}

/** channel_id numérico (long) — Zoho exige numérico, no UUID. */
export function newChannelId(): string {
  // crypto.randomInt admite un rango máximo de 2^48-1 (281474976710655). Para un
  // channel_id largo y único combinamos timestamp (segundos) + un aleatorio de 6
  // dígitos: ~16 dígitos, siempre creciente, dentro del rango de un BIGINT.
  const secs = Math.floor(Date.now() / 1000); // ~10 dígitos
  const rand = crypto.randomInt(0, 1_000_000); // 6 dígitos, bien dentro del límite
  return `${secs}${String(rand).padStart(6, "0")}`;
}

export function newSubscriptionToken(): string {
  // base64url ~43 chars, por debajo del límite de 50 de Zoho.
  return crypto.randomBytes(32).toString("base64url");
}

async function zohoWatchRequest(
  integrationId: string,
  method: "POST" | "DELETE",
  pathSuffix: string,
  body?: unknown
): Promise<unknown> {
  const tokens = await getValidTokens(integrationId);
  if (!tokens.apiBase) {
    throw new ZohoPullError(
      "OAUTH_MISSING",
      "Zoho subscription: apiBase no disponible (metadata.api_domain)"
    );
  }
  const url = `${tokens.apiBase}/crm/v8/actions/watch${pathSuffix}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${tokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ZohoPullError("SUBSCRIPTION_FAILED", "Zoho watch request network error", err);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ZohoPullError(
      "SUBSCRIPTION_FAILED",
      `Zoho watch ${method} ${res.status}: ${JSON.stringify(json)?.slice(0, 200)}`,
      json
    );
  }
  return json;
}

// ─── Subscribe ──────────────────────────────────────────────────────────────

/**
 * Registra la suscripción Notifications API para una integración. Genera un
 * channel_id + token nuevos, llama a Zoho /actions/watch y persiste los datos
 * en zoho_sync_connections. notify_url incluye ?token=<token> para que el
 * webhook valide la autenticidad.
 */
export async function subscribeZohoNotifications(integrationId: string): Promise<SubscribeResult> {
  const channelId = newChannelId();
  const subscriptionToken = newSubscriptionToken();
  const expiry = buildExpiryIso();
  const notifyUrl = `${publicBaseUrl()}/api/webhooks/zoho?token=${encodeURIComponent(subscriptionToken)}`;

  await zohoWatchRequest(integrationId, "POST", "", {
    watch: [
      {
        channel_id: channelId,
        events: WATCH_EVENTS,
        channel_expiry: expiry,
        token: subscriptionToken,
        notify_url: notifyUrl,
      },
    ],
  });

  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("zoho_sync_connections" as any) as any)
    .update({
      subscription_channel_id: channelId,
      subscription_token: subscriptionToken,
      subscription_expiry: expiry,
      subscription_method: "notifications_api",
    })
    .eq("integration_id", integrationId);

  if (error) {
    throw new ZohoPullError("SUBSCRIPTION_FAILED", `Persistir suscripción falló: ${error.message}`);
  }

  log.info("Zoho Notifications suscripción creada", { integration_id: integrationId, expiry });
  return { channelId, subscriptionToken, expiry };
}

// ─── Unsubscribe ──────────────────────────────────────────────────────────────

/** Desactiva la suscripción en Zoho y limpia las columnas en BD. */
export async function unsubscribeZohoNotifications(integrationId: string): Promise<void> {
  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (supabase.from("zoho_sync_connections" as any) as any)
    .select("subscription_channel_id")
    .eq("integration_id", integrationId)
    .maybeSingle();

  const channelId = conn?.subscription_channel_id as string | undefined;
  if (channelId) {
    // DELETE /actions/watch?channel_ids=<id> — best-effort (no bloquear si falla).
    try {
      await zohoWatchRequest(
        integrationId,
        "DELETE",
        `?channel_ids=${encodeURIComponent(channelId)}`
      );
    } catch (err) {
      log.warn("Zoho unsubscribe en remoto falló (limpiamos BD igualmente)", {
        integration_id: integrationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("zoho_sync_connections" as any) as any)
    .update({
      subscription_channel_id: null,
      subscription_token: null,
      subscription_expiry: null,
    })
    .eq("integration_id", integrationId);

  log.info("Zoho Notifications suscripción eliminada", { integration_id: integrationId });
}

// ─── Renew ──────────────────────────────────────────────────────────────────

/**
 * Renueva la suscripción reusando el MISMO channel_id + token (re-POST con
 * nuevo expiry). La usa el cron de renovación de Fase 05b. Si no hay channel_id
 * previo (o token), hace una suscripción nueva.
 */
export async function renewZohoNotifications(integrationId: string): Promise<SubscribeResult> {
  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (supabase.from("zoho_sync_connections" as any) as any)
    .select("subscription_channel_id, subscription_token")
    .eq("integration_id", integrationId)
    .maybeSingle();

  const channelId = conn?.subscription_channel_id as string | undefined;
  const subscriptionToken = conn?.subscription_token as string | undefined;

  if (!channelId || !subscriptionToken) {
    // Nada que renovar → suscribir de cero.
    return subscribeZohoNotifications(integrationId);
  }

  const expiry = buildExpiryIso();
  const notifyUrl = `${publicBaseUrl()}/api/webhooks/zoho?token=${encodeURIComponent(subscriptionToken)}`;

  await zohoWatchRequest(integrationId, "POST", "", {
    watch: [
      {
        channel_id: channelId,
        events: WATCH_EVENTS,
        channel_expiry: expiry,
        token: subscriptionToken,
        notify_url: notifyUrl,
      },
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("zoho_sync_connections" as any) as any)
    .update({ subscription_expiry: expiry, subscription_method: "notifications_api" })
    .eq("integration_id", integrationId);

  log.info("Zoho Notifications suscripción renovada", { integration_id: integrationId, expiry });
  return { channelId, subscriptionToken, expiry };
}
