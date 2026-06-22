/**
 * PATCH /api/integrations/manage/[id]/write-policy
 *
 * Body: { write_policy, override_fields }
 * Persiste el cambio tenant-scoped.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getIntegrationById,
  requireTenantId,
  writePolicySchema,
} from "@/lib/integrations/crm/server-actions";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  let tenantId: string;
  try {
    tenantId = await requireTenantId();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = writePolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const integration = await getIntegrationById(id, tenantId);
  if (!integration) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from("integrations")
    .update({
      write_policy: parsed.data.write_policy,
      override_fields: parsed.data.override_fields,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...parsed.data });
}
