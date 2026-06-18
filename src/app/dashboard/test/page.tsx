import { getKpiGenerales, getDynamicKpis } from "@/lib/actions/analytics";
import { getActiveTenantConfig } from "@/lib/actions/tenant";
import { getActiveTenantId } from "@/lib/supabase/server";
import { DEFAULT_OVERVIEW_KPIS } from "@/lib/constants/kpi-defaults";

export const dynamic = "force-dynamic";

export default async function TestPage() {
  const diagnosticData: Record<string, unknown> = {};

  try {
    const tenantId = await getActiveTenantId();
    diagnosticData.tenantId = tenantId;

    const tenantConfig = await getActiveTenantConfig();
    diagnosticData.tenantConfig = tenantConfig ? { id: tenantConfig.id, name: tenantConfig.name } : null;

    if (tenantId) {
      const now = new Date();
      // Test "all" date range first to see if any data matches
      const from = new Date(2000, 0, 1).toISOString();
      const to = now.toISOString();

      diagnosticData.dateRange = { from, to };

      try {
        const kpi = await getKpiGenerales(from, to, {});
        diagnosticData.kpiGenerales = kpi;
      } catch (kpiErr) {
        const errObj = kpiErr as Error;
        diagnosticData.kpiGeneralesError = { message: errObj.message, stack: errObj.stack };
      }

      try {
        const dynamicValues = await getDynamicKpis(
          from,
          to,
          DEFAULT_OVERVIEW_KPIS.filter((k) => !k.staticKey),
          {}
        );
        diagnosticData.dynamicKpis = dynamicValues;
      } catch (dynErr) {
        const errObj = dynErr as Error;
        diagnosticData.dynamicKpisError = { message: errObj.message, stack: errObj.stack };
      }
    }
  } catch (err) {
    const errObj = err as Error;
    diagnosticData.globalError = { message: errObj.message, stack: errObj.stack };
  }

  return (
    <div className="p-8 font-mono bg-slate-900 text-slate-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-emerald-400">Dashboard Diagnostic Data</h1>
      <pre className="bg-slate-950 p-6 rounded-2xl border border-slate-800 overflow-x-auto">
        {JSON.stringify(diagnosticData, null, 2)}
      </pre>
    </div>
  );
}
