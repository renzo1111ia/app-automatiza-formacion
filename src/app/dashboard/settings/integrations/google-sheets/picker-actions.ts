"use server";

// Sprint 4 - Server actions auxiliares para el Google Picker en cliente.
// Vivien en page-scope (no en lib) porque solo son necesarias para este wizard.

import { GoogleSheetsAdapter } from "@/lib/integrations/sheets/adapter";
import { getAppCredentials } from "@/lib/integrations/sheets/credentials";
import { requireCurrentTenant } from "@/lib/integrations/sheets/session";

/**
 * Devuelve el access_token actual del tenant para usarlo desde el cliente
 * SOLO con google.picker (no exponer al resto del front). El token es de
 * corta vida (1h) y solo da permisos del scope drive.file ya autorizados.
 */
export async function getPickerAccessTokenAction(): Promise<
  { ok: true; accessToken: string } | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const adapter = await GoogleSheetsAdapter.forTenant(tenantId);
    // Forzar refresh si caducado tocando una llamada barata.
    await adapter.getUserEmail().catch(() => null);
    const token = adapter.getAccessTokenForClient();
    if (!token) return { ok: false, error: "no_token" };
    return { ok: true, accessToken: token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Devuelve el "project number" extraido del Client ID del tenant. Google
 * Picker lo pide como setAppId. El project number es el primer segmento del
 * Client ID (formato: <projectNumber>-<random>.apps.googleusercontent.com).
 */
export async function getAppClientIdForPickerAction(): Promise<
  { ok: true; projectNumber: string } | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const creds = await getAppCredentials(tenantId);
    const projectNumber = creds.clientId.split("-")[0];
    if (!projectNumber || !/^\d+$/.test(projectNumber)) {
      return { ok: false, error: "client_id_format_invalid" };
    }
    return { ok: true, projectNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
