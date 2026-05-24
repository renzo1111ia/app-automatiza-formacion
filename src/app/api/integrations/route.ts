/**
 * GET /api/integrations — lista las integrations CRM del tenant activo.
 */
import { NextResponse } from "next/server";
import { listIntegrations, requireTenantId } from "@/lib/integrations/crm/server-actions";

export async function GET() {
  let tenantId: string;
  try {
    tenantId = await requireTenantId();
  } catch (err) {
    return NextResponse.json({ rows: [], error: (err as Error).message }, { status: 401 });
  }
  const rows = await listIntegrations(tenantId);
  return NextResponse.json({ rows });
}
