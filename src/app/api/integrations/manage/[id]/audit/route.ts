/**
 * GET /api/integrations/manage/[id]/audit?lead_id=...&limit=50&offset=0
 *
 * Devuelve audit log filtrado por la integración (tenant-scoped via RLS).
 */
import { NextRequest, NextResponse } from "next/server";
import { getIntegrationById, requireTenantId } from "@/lib/integrations/crm/server-actions";
import { getAuditLog } from "@/lib/integrations/crm/audit-query";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  let tenantId: string;
  try {
    tenantId = await requireTenantId();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }

  const integration = await getIntegrationById(id, tenantId);
  if (!integration) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = new URL(request.url);
  const leadId = url.searchParams.get("lead_id") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const rows = await getAuditLog({
    tenantId,
    integrationId: id,
    leadId,
    limit: Math.min(limit, 200),
    offset,
  });

  return NextResponse.json({ rows });
}
