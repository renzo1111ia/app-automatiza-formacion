/**
 * POST /api/integrations/manage/[id]/disconnect
 *
 * Invoca provider.disconnect() (revoke remoto si soportado) + soft-delete:
 * marca is_active=false y limpia credentials_cipher. Mantiene la row para audit
 * histórico (crm_write_audit.integration_id FK).
 */
import { NextRequest, NextResponse } from "next/server";
import { getIntegrationById, requireTenantId } from "@/lib/integrations/crm/server-actions";
import { CRMFactory } from "@/lib/integrations/crm/factory";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  let tenantId: string;
  try {
    tenantId = await requireTenantId();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }

  const integration = await getIntegrationById(id, tenantId);
  if (!integration) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const provider = await CRMFactory.getProviderForIntegration(id);
    await provider.disconnect();
  } catch (err) {
    console.error(`[disconnect] provider.disconnect failed: ${(err as Error).message}`);
  }

  CRMFactory.invalidateProvider(id);

  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("integrations" as any) as any)
    .update({
      is_active: false,
      credentials_cipher: null,
      expires_at: null,
      healthcheck_status: null,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
