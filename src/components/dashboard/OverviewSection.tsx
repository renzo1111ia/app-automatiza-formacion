import { getKpiGenerales, getDynamicKpis, type AnalyticsFilters } from "@/lib/actions/analytics";
import { getActiveTenantConfig } from "@/lib/actions/tenant";
import { SummaryManager } from "@/components/dashboard/SummaryManager";
import { DEFAULT_OVERVIEW_KPIS } from "@/lib/constants/kpi-defaults";
import type { KpiConfig } from "@/types/tenant";
import { LayoutDashboard } from "lucide-react";

/**
 * Sprint 2B — Sección Overview cross-canal del /dashboard.
 * Reusa SummaryManager con configKey="overview_kpis" y DEFAULT_OVERVIEW_KPIS
 * como fallback. Persistencia: tenants.config.overview_kpis JSONB (zero-migration).
 *
 * Filtros del FilterBar (rango fechas, campaña, origen, etc.) se aplican.
 * KPI Builder (phase-05) edita esta sección vía configKey="overview_kpis".
 */
export async function OverviewSection({
  from,
  to,
  isAdmin,
  filters,
}: {
  from: string;
  to: string;
  isAdmin: boolean;
  filters: AnalyticsFilters;
}) {
  const tenantConfig = await getActiveTenantConfig();
  if (!tenantConfig) return null;

  const tenantOverviewKpis =
    ((tenantConfig.config as Record<string, unknown>)?.overview_kpis as KpiConfig[]) || [];
  const mergedKpis = tenantOverviewKpis.length > 0 ? tenantOverviewKpis : DEFAULT_OVERVIEW_KPIS;

  const [kpi, dynamicValues] = await Promise.all([
    getKpiGenerales(from, to, filters),
    getDynamicKpis(
      from,
      to,
      mergedKpis.filter((k) => !k.staticKey),
      filters
    ),
  ]);

  return (
    <section aria-labelledby="overview-heading" className="mt-2 mb-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="bg-primary/10 rounded-[20px] p-3">
          <LayoutDashboard className="text-primary h-8 w-8" aria-hidden="true" />
        </div>
        <div>
          <h2
            id="overview-heading"
            className="text-foreground text-[32px] leading-tight font-bold tracking-tight"
          >
            Resumen <span className="text-primary">general</span>
          </h2>
          <p className="text-muted-foreground text-[15px] font-medium">
            KPIs cross-canal: llamadas, WhatsApp y web consolidados
          </p>
        </div>
      </div>
      <SummaryManager
        tenant={tenantConfig}
        initialKpis={mergedKpis}
        values={kpi}
        dynamicValues={dynamicValues}
        isAdmin={isAdmin}
        configKey="overview_kpis"
        from={from}
        to={to}
        filters={filters}
        title={null}
      />
    </section>
  );
}
