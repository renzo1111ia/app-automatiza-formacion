import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TestDiagnosticPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>;
}) {
  const params = await searchParams;
  const tenantId = params.tenantId || "335be450-c821-4922-a4d9-ad268ac2c394";
  const diagnosticData: Record<string, unknown> = { tenantId };

  try {
    const supabase = await getSupabaseServerClient();
    
    // Fetch tenant details to verify connection
    const { data: tenantData, error: tError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    if (tError) {
      diagnosticData.tenantFetchError = { message: tError.message, details: tError.details };
    } else {
      diagnosticData.tenant = tenantData;
    }

    const now = new Date("2026-06-12T12:00:00Z");
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = now.toISOString();
    diagnosticData.dateRange = { from, to };

    // Let's call getKpiGenerales directly!
    // But since getKpiGenerales internally calls getActiveTenantId(), which reads cookies(),
    // we need to set a cookie or we can mock getKpiGenerales by copying its queries here.
    
    // Let's run the exact same queries as getKpiGenerales but using tenantId:
    const [lRes, llRes, cRes, aRes, wRes] = await Promise.all([
      supabase.from("lead" as never).select("id, pais, origen, campana, tipo_lead, fecha_ingreso_crm").eq("tenant_id", tenantId).gte("fecha_ingreso_crm", from).lte("fecha_ingreso_crm", to),
      supabase.from("llamadas" as never).select(`id, estado_llamada, razon_termino, fecha_inicio, duracion_segundos, lead:id_lead!inner(id, pais, origen, campana, tipo_lead)`).eq("tenant_id", tenantId).gte("fecha_inicio", from).lte("fecha_inicio", to),
      supabase.from("lead_cualificacion" as never).select(`cualificacion, motivo_anulacion, lead:id_lead!inner(id, pais, origen, campana, tipo_lead)`).eq("tenant_id", tenantId).gte("fecha_creacion", from).lte("fecha_creacion", to),
      supabase.from("agendamientos" as never).select(`id, fecha_agendada_cliente, confirmado, lead:id_lead!inner(id, pais, origen, campana, tipo_lead)`).eq("tenant_id", tenantId).eq("confirmado", true).gte("fecha_creacion", from).lte("fecha_creacion", to),
      supabase.from("conversaciones_whatsapp" as never).select(`id_lead, lead:id_lead!inner(id, pais, origen, campana, tipo_lead)`).eq("tenant_id", tenantId).gte("fecha_ultimo_mensaje", from).lte("fecha_ultimo_mensaje", to),
    ]);

    diagnosticData.kpiQueries = {
      leads: { count: lRes.data?.length, error: lRes.error?.message },
      llamadas: { count: llRes.data?.length, error: llRes.error?.message },
      cualificaciones: { count: cRes.data?.length, error: cRes.error?.message },
      agendamientos: { count: aRes.data?.length, error: aRes.error?.message },
      whatsapp: { count: wRes.data?.length, error: wRes.error?.message },
    };

    // Let's do the same for ALL TIME
    const fromAll = new Date(2000, 0, 1).toISOString();
    const [lResAll, llResAll, cResAll, aResAll, wResAll] = await Promise.all([
      supabase.from("lead" as never).select("id, pais, origen, campana, tipo_lead, fecha_ingreso_crm").eq("tenant_id", tenantId).gte("fecha_ingreso_crm", fromAll).lte("fecha_ingreso_crm", to),
      supabase.from("llamadas" as never).select(`id, estado_llamada, razon_termino, fecha_inicio, duracion_segundos, lead:id_lead!inner(id, pais, origen, campana, tipo_lead)`).eq("tenant_id", tenantId).gte("fecha_inicio", fromAll).lte("fecha_inicio", to),
      supabase.from("lead_cualificacion" as never).select(`cualificacion, motivo_anulacion, lead:id_lead!inner(id, pais, origen, campana, tipo_lead)`).eq("tenant_id", tenantId).gte("fecha_creacion", fromAll).lte("fecha_creacion", to),
      supabase.from("agendamientos" as never).select(`id, fecha_agendada_cliente, confirmado, lead:id_lead!inner(id, pais, origen, campana, tipo_lead)`).eq("tenant_id", tenantId).eq("confirmado", true).gte("fecha_creacion", fromAll).lte("fecha_creacion", to),
      supabase.from("conversaciones_whatsapp" as never).select(`id_lead, lead:id_lead!inner(id, pais, origen, campana, tipo_lead)`).eq("tenant_id", tenantId).gte("fecha_ultimo_mensaje", fromAll).lte("fecha_ultimo_mensaje", to),
    ]);

    diagnosticData.kpiQueriesAllTime = {
      leads: { count: lResAll.data?.length, error: lResAll.error?.message },
      llamadas: { count: llResAll.data?.length, error: llResAll.error?.message },
      cualificaciones: { count: cResAll.data?.length, error: cResAll.error?.message },
      agendamientos: { count: aResAll.data?.length, error: aResAll.error?.message },
      whatsapp: { count: wResAll.data?.length, error: wResAll.error?.message },
    };

  } catch (err) {
    const errObj = err as Error;
    diagnosticData.globalError = { message: errObj.message, stack: errObj.stack };
  }

  return (
    <div className="p-8 font-mono bg-slate-900 text-slate-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-emerald-400">Date Range Diagnostics</h1>
      <pre className="bg-slate-950 p-6 rounded-2xl border border-slate-800 overflow-x-auto text-xs">
        {JSON.stringify(diagnosticData, null, 2)}
      </pre>
    </div>
  );
}
