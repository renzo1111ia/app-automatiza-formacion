// Sprint 4 - Inicia el flow OAuth Google Sheets para el tenant en sesion.
//
// Cambios respecto Sprint 1:
//   - Credenciales OAuth (Client ID/Secret) leidas de integrations del tenant
//     (cifradas con AES-256-GCM), NO de env vars globales.
//   - Scope = drive.file + userinfo.email (scope minimo non-sensitive).
//   - State firmado HMAC para anti-CSRF (reutiliza generateOAuthState Sprint 2).
//   - tenantId resuelto del usuario en sesion (no query param manipulable).

import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getAppCredentials } from "@/lib/integrations/sheets/credentials";
import { requireCurrentTenant } from "@/lib/integrations/sheets/session";
import { generateOAuthState } from "@/lib/integrations/crm/oauth/oauth-state";

const REDIRECT_PATH = "/api/integrations/google/callback";

export async function GET() {
  try {
    const { tenantId } = await requireCurrentTenant();

    const creds = await getAppCredentials(tenantId).catch(() => null);
    if (!creds) {
      const back = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8500"}/dashboard/settings/integraciones/google-sheets?error=missing_credentials`;
      return NextResponse.redirect(back);
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8500"}${REDIRECT_PATH}`;
    const oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret, redirectUri);

    const scopes = [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    const state = generateOAuthState(tenantId);
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      include_granted_scopes: true,
      state,
    });

    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[GOOGLE AUTH] Error iniciando OAuth flow:", err);
    const msg = err instanceof Error ? err.message : "internal_error";
    const back = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8500"}/dashboard/settings/integraciones/google-sheets?error=${encodeURIComponent(msg)}`;
    return NextResponse.redirect(back);
  }
}
