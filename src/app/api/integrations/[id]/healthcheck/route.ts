/**
 * POST /api/integrations/[id]/healthcheck
 *
 * Carga la integration tenant-scoped, invoca provider.healthcheck(), persiste
 * `last_healthcheck_at` + `healthcheck_status`. Devuelve JSON.
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

  const start = Date.now();
  let ok = false;
  let errorMessage: string | undefined;
  try {
    const provider = await CRMFactory.getProviderForIntegration(id);
    ok = await provider.healthcheck();
  } catch (err) {
    errorMessage = (err as Error).message;
    ok = false;
  }
  const latencyMs = Date.now() - start;

  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("integrations" as any) as any)
    .update({
      last_healthcheck_at: new Date().toISOString(),
      healthcheck_status: ok ? "ok" : "error",
    })
    .eq("id", id);

  return NextResponse.json({ ok, latencyMs, error: errorMessage });
}
