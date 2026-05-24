/**
 * POST /api/integrations/[provider]/auth/start
 *
 * Inicia el flow OAuth: genera state HMAC, lo persiste como cookie httpOnly +
 * en `integrations.oauth_state`, construye URL de autorización del CRM y
 * redirige al usuario (full-page redirect).
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildRedirectUri,
  getProviderEnv,
  providerParamSchema,
  requireTenantId,
} from "@/lib/integrations/crm/server-actions";
import { generateOAuthState } from "@/lib/integrations/crm/oauth/oauth-state";
import { CRMFactory } from "@/lib/integrations/crm/factory";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ provider: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  return handleStart(context);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  // GET conveniencia para enlace directo desde la UI (no requiere form submit).
  return handleStart(context);
}

async function handleStart(context: RouteContext): Promise<NextResponse> {
  const { provider } = await context.params;
  const parsed = providerParamSchema.safeParse({ provider });
  if (!parsed.success) {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  }
  const providerKey = parsed.data.provider;

  let tenantId: string;
  try {
    tenantId = await requireTenantId();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }

  let env: { clientId: string; clientSecret: string };
  try {
    env = getProviderEnv(providerKey);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const state = generateOAuthState(tenantId);
  const redirectUri = buildRedirectUri(providerKey);

  // Upsert row de integrations con oauth_state (is_active=false hasta callback ok).
  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("integrations" as any) as any).upsert(
    {
      tenant_id: tenantId,
      crm_type: providerKey,
      is_active: false,
      oauth_state: state,
    },
    { onConflict: "tenant_id,crm_type" }
  );
  if (error) {
    console.error(`[oauth/start] upsert integrations failed: ${error.message}`);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Cookie httpOnly TTL 15min para validación CSRF en el callback.
  const cookieStore = await cookies();
  cookieStore.set({
    name: `oauth_state_${providerKey}`,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });

  const oauthProvider = CRMFactory.createForOAuthFlow(providerKey, {
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    redirectUri,
  });
  const authUrl = oauthProvider.getAuthorizationUrl(state, redirectUri);

  return NextResponse.redirect(authUrl, { status: 302 });
}
