import {
  getKpiGenerales,
  getDynamicKpis,
  getDynamicChartSeries,
  type AnalyticsFilters,
} from "@/lib/actions/analytics";
import { getActiveTenantConfig } from "@/lib/actions/tenant";
import { SummaryManager } from "@/components/dashboard/SummaryManager";
import { ChartManager } from "@/components/dashboard/ChartManager";
import { OverviewCanalDistribution } from "@/components/dashboard/OverviewCanalDistribution";
import { DEFAULT_OVERVIEW_KPIS, DEFAULT_OVERVIEW_CHARTS } from "@/lib/constants/kpi-defaults";
import type { KpiConfig, ChartConfig } from "@/types/tenant";
import { LayoutDashboard } from "lucide-react";

// TODO Sprint 3 hardening: cuando se añadan trend badges (+12%, -3%) a los
// KPI cards del overview, deben incluir aria-label descriptivo + icono
// direccional (TrendingUp/TrendingDown). Color no puede ser único indicador
// (WCAG 2.2 AA criterion 1.4.1). Patrón en phase-06 plan.

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

  const tenantOverviewCharts =
    ((tenantConfig.config as Record<string, unknown>)?.overview_charts as ChartConfig[]) || [];
  const mergedCharts =
    tenantOverviewCharts.length > 0 ? tenantOverviewCharts : DEFAULT_OVERVIEW_CHARTS;

  const [kpi, dynamicValues, chartData] = await Promise.all([
    getKpiGenerales(from, to, filters),
    getDynamicKpis(
      from,
      to,
      mergedKpis.filter((k) => !k.staticKey),
      filters
    ),
    getDynamicChartSeries(mergedCharts, from, to, filters),
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
        editButtonLabel="Personalizar Overview"
      />

      {/* 4 charts default: 3 dynamic vía ChartManager + 1 custom canal distribution */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <ChartManager
            tenant={tenantConfig}
            initialCharts={mergedCharts}
            data={chartData}
            isAdmin={isAdmin}
            configKey="overview_charts"
            filters={filters}
            title="Gráficos Overview"
          />
        </div>
        <div className="bg-card rounded-2xl border p-6">
          <OverviewCanalDistribution kpi={kpi} />
        </div>
      </div>
    </section>
  );
}
