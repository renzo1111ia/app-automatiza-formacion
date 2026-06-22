/**
 * GET /api/integrations/[provider]/auth/callback
 *
 * Recibe el `code` + `state` del CRM. Valida triple-check (cookie + DB + HMAC),
 * intercambia code por tokens, los cifra y persiste, y redirige a settings.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildRedirectUri,
  getProviderEnv,
  providerParamSchema,
} from "@/lib/integrations/crm/server-actions";
import { verifyOAuthState, extractTenantId } from "@/lib/integrations/crm/oauth/oauth-state";
import { CRMFactory } from "@/lib/integrations/crm/factory";
import { getActiveTenantId, getAdminSupabaseClient } from "@/lib/supabase/server";
import { encryptJson } from "@/lib/crypto/token-crypto";
import { extractDCFromCallback } from "@/lib/integrations/crm/providers/zoho-dc-detector";
import type { ZohoCRMProvider } from "@/lib/integrations/crm/providers/zoho";
import type { HubSpotCRMProvider } from "@/lib/integrations/crm/providers/hubspot";

interface RouteContext {
  params: Promise<{ provider: string }>;
}

// Zoho usa su propia página autocontenida (Ajustes → Zoho CRM) para todo el
// flujo (conectar + activar + mapeo), igual que Google Sheets. Por eso tanto el
// éxito como los errores del OAuth Zoho vuelven a esa página, mientras el resto
// de CRMs (HubSpot) siguen yendo a la página de edición de cliente.
function settingsRedirect(query: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8500";
  const target = /provider=zoho(&|$)/.test(query)
    ? `${base}/dashboard/settings/integrations/zoho-pull?${query}`
    : `${base}/dashboard/settings?section=integrations&${query}`;
  return NextResponse.redirect(target, { status: 302 });
}

// Redirect explícito a la página Zoho autocontenida (caso de éxito, donde el
// query no lleva `provider=` pero sí queremos volver a Zoho).
function zohoRedirect(query: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8500";
  return NextResponse.redirect(`${base}/dashboard/settings/integrations/zoho-pull?${query}`, {
    status: 302,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { provider } = await context.params;
  const parsed = providerParamSchema.safeParse({ provider });
  if (!parsed.success) {
    return settingsRedirect(`error=unsupported_provider`);
  }
  const providerKey = parsed.data.provider;

  const url = new URL(request.url);
  const sp = url.searchParams;
  const error = sp.get("error");
  const code = sp.get("code");
  const state = sp.get("state");

  if (error || !code || !state) {
    return settingsRedirect(`error=${error ?? "oauth_failed"}&provider=${providerKey}`);
  }

  // Triple-check del state.
  const cookieStore = await cookies();
  const cookieState = cookieStore.get(`oauth_state_${providerKey}`)?.value;
  if (!cookieState || cookieState !== state) {
    return settingsRedirect(`error=csrf_mismatch&provider=${providerKey}`);
  }

  const tenantId = extractTenantId(state);
  if (!tenantId || !verifyOAuthState(state, tenantId)) {
    return settingsRedirect(`error=csrf_mismatch&provider=${providerKey}`);
  }

  // F-API-1 — defensa contra session swap: el usuario que completa el callback
  // DEBE ser owner del tenant_id encoded en el state (no basta con que la
  // cookie httpOnly persista — un user nuevo en mismo browser podría aprobar
  // el flow de un user anterior).
  const sessionTenantId = await getActiveTenantId();
  if (sessionTenantId !== tenantId) {
    return settingsRedirect(`error=session_mismatch&provider=${providerKey}`);
  }

  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: dbErr } = await supabase
    .from("integrations")
    .select("id, tenant_id, oauth_state")
    .eq("tenant_id", tenantId)
    .eq("crm_type", providerKey)
    .maybeSingle();
  if (dbErr || !row || row.oauth_state !== state) {
    return settingsRedirect(`error=csrf_mismatch&provider=${providerKey}`);
  }

  // Intercambio code → tokens.
  let env: { clientId: string; clientSecret: string };
  try {
    env = getProviderEnv(providerKey);
  } catch (err) {
    console.error(`[oauth/callback] missing env: ${(err as Error).message}`);
    return settingsRedirect(`error=server_misconfigured&provider=${providerKey}`);
  }

  const redirectUri = buildRedirectUri(providerKey);
  let metadataUpdate: Record<string, unknown> = {};
  let accessToken: string;
  let refreshToken: string;
  let expiresAt: Date;
  let scopes: string[];
  let portalId: string | null = null;

  try {
    if (providerKey === "zoho") {
      const dc = extractDCFromCallback(sp);
      const zohoProvider = CRMFactory.createForOAuthFlow("zoho", {
        clientId: env.clientId,
        clientSecret: env.clientSecret,
        redirectUri,
        metadata: { accounts_server: dc.accountsServer, location: dc.location },
      }) as ZohoCRMProvider;
      const tokens = await zohoProvider.completeOAuthWithContext(code, redirectUri, dc);
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
      expiresAt = tokens.expiresAt;
      scopes = tokens.scopes;
      metadataUpdate = {
        api_domain: tokens.apiBase,
        accounts_server: dc.accountsServer,
        location: dc.location,
      };
    } else {
      const hsProvider = CRMFactory.createForOAuthFlow("hubspot", {
        clientId: env.clientId,
        clientSecret: env.clientSecret,
        redirectUri,
      }) as HubSpotCRMProvider;
      const tokens = await hsProvider.completeOAuth(code, redirectUri);
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
      expiresAt = tokens.expiresAt;
      scopes = tokens.scopes;
      portalId = tokens.portalId ?? null;
    }
  } catch (err) {
    console.error(
      `[oauth/callback] completeOAuth ${providerKey} failed: ${(err as Error).message}`
    );
    return settingsRedirect(`error=oauth_failed&provider=${providerKey}`);
  }

  const credentialsCipher = encryptJson({ accessToken, refreshToken });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await supabase
    .from("integrations")
    .update({
      credentials_cipher: credentialsCipher,
      expires_at: expiresAt.toISOString(),
      metadata: metadataUpdate,
      portal_id: portalId,
      oauth_state: null,
      scopes,
      is_active: true,
      healthcheck_status: null,
      last_healthcheck_at: null,
    })
    .eq("id", row.id);

  if (updateErr) {
    console.error(`[oauth/callback] persist tokens failed: ${updateErr.message}`);
    return settingsRedirect(`error=persist_failed&provider=${providerKey}`);
  }

  // HubSpot: provisionar custom properties (best-effort, no bloquea redirect).
  if (providerKey === "hubspot") {
    CRMFactory.getProviderForIntegration(row.id)
      .then((p) => (p as HubSpotCRMProvider).init?.())
      .catch((err) => console.error(`[oauth/callback] hubspot init failed: ${err.message}`));
  }

  // F-API-2 — cookie deletion debe aplicarse al response final (Next.js 15
  // Route Handler: mutaciones via cookies() pueden no persistir tras crear
  // un NextResponse independiente).
  const response =
    providerKey === "zoho" ? zohoRedirect(`success=1`) : settingsRedirect(`success=${providerKey}`);
  response.cookies.delete(`oauth_state_${providerKey}`);
  return response;
}
