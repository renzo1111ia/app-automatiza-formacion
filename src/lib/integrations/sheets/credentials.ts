// Sprint 4 - Google Sheets bidireccional
//
// Gestion de credenciales OAuth de la app Google Cloud del tenant.
// Cada tenant trae sus propias credenciales (decision arquitectonica 27-05-2026):
// nada centralizado en .env. Tokens OAuth y Client ID/Secret viven cifrados
// (AES-256-GCM) en columnas separadas de la tabla integrations.

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/crypto/token-crypto";
import { SheetsAdapterError } from "./types";

export interface SheetsAppCredentials {
  clientId: string;
  clientSecret: string;
}

export interface SheetsIntegrationRow {
  id: string;
  tenant_id: string;
  crm_type: string;
  is_active: boolean;
  app_client_id_cipher: string | null;
  app_client_secret_cipher: string | null;
  credentials_cipher: string | null;
  scopes: string[] | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Devuelve la fila de integrations para el tenant (crm_type=google_sheets, activa).
 * Si no existe, devuelve null.
 */
export async function getSheetsIntegration(tenantId: string): Promise<SheetsIntegrationRow | null> {
  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("integrations" as any) as any)
    .select(
      "id, tenant_id, crm_type, is_active, app_client_id_cipher, app_client_secret_cipher, credentials_cipher, scopes, expires_at, metadata"
    )
    .eq("tenant_id", tenantId)
    .eq("crm_type", "google_sheets")
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    throw new SheetsAdapterError(
      "CREDENTIALS_INVALID",
      `Error leyendo integracion Sheets del tenant ${tenantId}: ${error.message}`,
      error
    );
  }
  return data as SheetsIntegrationRow | null;
}

/**
 * Crea (si no existe) o actualiza la fila integrations del tenant con las
 * credenciales de la app OAuth (Client ID + Secret) que el tenant registro
 * en su propio Google Cloud Console.
 */
export async function setAppCredentials(
  tenantId: string,
  creds: SheetsAppCredentials,
  options: { displayName?: string; createdBy?: string } = {}
): Promise<string> {
  if (!creds.clientId.trim() || !creds.clientSecret.trim()) {
    throw new SheetsAdapterError(
      "CREDENTIALS_INVALID",
      "Client ID y Client Secret son obligatorios"
    );
  }

  const supabase = await getAdminSupabaseClient();
  const existing = await getSheetsIntegration(tenantId);
  const cipherId = encryptToken(creds.clientId.trim());
  const cipherSecret = encryptToken(creds.clientSecret.trim());

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("integrations" as any) as any)
      .update({
        app_client_id_cipher: cipherId,
        app_client_secret_cipher: cipherSecret,
      })
      .eq("id", existing.id);
    if (error) {
      throw new SheetsAdapterError(
        "CREDENTIALS_INVALID",
        `Error actualizando credenciales: ${error.message}`,
        error
      );
    }
    return existing.id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("integrations" as any) as any)
    .insert({
      tenant_id: tenantId,
      crm_type: "google_sheets",
      display_name: options.displayName ?? "Google Sheets",
      is_active: true,
      app_client_id_cipher: cipherId,
      app_client_secret_cipher: cipherSecret,
      metadata: {},
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new SheetsAdapterError(
      "CREDENTIALS_INVALID",
      `Error creando integracion: ${error?.message ?? "no row"}`,
      error
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any).id as string;
}

/**
 * Descifra y devuelve Client ID + Secret del tenant. Lanza si no estan
 * registrados todavia.
 */
export async function getAppCredentials(tenantId: string): Promise<SheetsAppCredentials> {
  const row = await getSheetsIntegration(tenantId);
  if (!row || !row.app_client_id_cipher || !row.app_client_secret_cipher) {
    throw new SheetsAdapterError(
      "OAUTH_MISSING",
      `Tenant ${tenantId} no tiene credenciales OAuth de Google Sheets configuradas`
    );
  }
  return {
    clientId: decryptToken(row.app_client_id_cipher),
    clientSecret: decryptToken(row.app_client_secret_cipher),
  };
}

// ─── OAuth tokens (rotables) ───────────────────────────────────────────────

export interface SheetsOAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
}

export async function saveOAuthTokens(
  integrationId: string,
  tokens: SheetsOAuthTokens
): Promise<void> {
  const supabase = await getAdminSupabaseClient();
  const cipher = encryptToken(JSON.stringify(tokens));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("integrations" as any) as any)
    .update({
      credentials_cipher: cipher,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scopes: tokens.scope ? tokens.scope.split(" ") : null,
      last_sync_at: new Date().toISOString(),
    })
    .eq("id", integrationId);
  if (error) {
    throw new SheetsAdapterError(
      "CREDENTIALS_INVALID",
      `Error guardando tokens OAuth: ${error.message}`,
      error
    );
  }
}

export async function getOAuthTokens(tenantId: string): Promise<SheetsOAuthTokens | null> {
  const row = await getSheetsIntegration(tenantId);
  if (!row || !row.credentials_cipher) return null;
  try {
    return JSON.parse(decryptToken(row.credentials_cipher)) as SheetsOAuthTokens;
  } catch (err) {
    throw new SheetsAdapterError(
      "CREDENTIALS_INVALID",
      "Tokens OAuth corruptos o cifrados con clave distinta",
      err
    );
  }
}
