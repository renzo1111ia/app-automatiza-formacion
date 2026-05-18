import { Suspense } from "react";
import { getKpiMinutos, getDynamicKpis, getDynamicChartSeries, type AnalyticsFilters, type KpiGenerales } from "@/lib/actions/analytics";
import { getActiveTenantConfig } from "@/lib/actions/tenant";
import { getAdminStatus } from "@/lib/actions/auth";
import { KpiSkeleton, ChartSkeleton } from "@/components/charts/DashboardCharts";
import { SummaryManager } from "@/components/dashboard/SummaryManager";
import { ChartManager } from "@/components/dashboard/ChartManager";
import { Bot } from "lucide-react";
import { LLAMADAS_KPIS, DEFAULT_CHARTS_LLAMADAS } from "@/lib/constants/kpi-defaults";
import { KpiConfig, ChartConfig } from "@/types/tenant";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { parseFilters } from "@/lib/utils/date-filters";

export const dynamic = "force-dynamic";

// ─── KPIs SECTION ─────────────────────────────────────────────────────────────

async function MinutosKpis({
    from, to, isAdmin, filters,
}: {
    from: string; to: string; isAdmin: boolean; filters: AnalyticsFilters;
}) {
    const tenantConfig = await getActiveTenantConfig();
    if (!tenantConfig) return null;

    const config = (tenantConfig.config || {}) as Record<string, unknown>;
    const currentKpis = config.kpis_llamadas as KpiConfig[] || [];
    const mergedKpis = currentKpis.length > 0 ? currentKpis : LLAMADAS_KPIS;

    const [kpi, dynamicValues] = await Promise.all([
        getKpiMinutos(from, to, filters),
        getDynamicKpis(from, to, mergedKpis.filter(k => !k.staticKey), filters)
    ]);

    // Build values compatible with KpiGenerales staticKey names
    const values = {
        total_llamadas:          kpi.total_llamadas,
        total_contactados:       kpi.total_contactadas,
        total_minutos:           kpi.total_segundos,
        total_segundos:          kpi.total_segundos,
        duracion_media_segundos: kpi.duracion_media_segundos,
        tasa_agendamiento:       kpi.tasa_agendamiento,
        tasa_conversion:         kpi.tasa_conversion,
        // pad unused fields so SummaryManager doesn't break
        total_leads: 0, total_no_contacto: 0, tasa_contacto: 0,
        total_agendados: 0, tiempo_respuesta_promedio_minutos: null,
        total_cualificados: 0, total_no_cualificados: 0, tasa_ilocalizables: 0,
        por_estado_llamada: [], por_razon_termino: [], por_origen: [],
        por_tipo_lead: [], por_cualificacion: [], por_motivo_anulacion: [],
        agendados_por_fecha: [], primer_contacto_por_fecha: [],
    } as unknown as KpiGenerales;

    return (
        <SummaryManager
            tenant={tenantConfig}
            initialKpis={mergedKpis}
            values={values}
            dynamicValues={dynamicValues}
            isAdmin={isAdmin}
            configKey="kpis_llamadas"
            from={from}
            to={to}
            filters={filters}
            title={
                <div className="mb-2">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-[20px]">
                            <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-[32px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                Agente de <span className="text-blue-600 dark:text-blue-400">voz</span>
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-[15px]">
                                Rendimiento del ciclo de contacto automatizado
                            </p>
                        </div>
                    </div>

                    {/* Hero metric */}
                    <div className="mt-6 flex items-end gap-10 flex-wrap">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total minutos</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-7xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                                    {Math.floor(kpi.total_segundos / 60).toLocaleString("es-ES")}
                                </span>
                                <span className="text-2xl font-black text-slate-400">min</span>
                                {kpi.total_segundos % 60 > 0 && (
                                    <>
                                        <span className="text-4xl font-black text-slate-700 dark:text-slate-300 tracking-tighter ml-2">
                                            {kpi.total_segundos % 60}
                                        </span>
                                        <span className="text-lg font-bold text-slate-400">seg</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-10 pb-2">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Duración media</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                                        {Math.floor(kpi.duracion_media_segundos / 60)}
                                    </span>
                                    <span className="text-sm font-bold text-slate-400">min</span>
                                    {kpi.duracion_media_segundos % 60 > 0 && (
                                        <>
                                            <span className="text-xl font-black text-blue-500/80 dark:text-blue-400/80 ml-1">
                                                {kpi.duracion_media_segundos % 60}
                                            </span>
                                            <span className="text-xs font-bold text-slate-400">seg</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Llamadas</p>
                                <p className="text-2xl font-black text-slate-700 dark:text-slate-200">
                                    {kpi.total_llamadas.toLocaleString("es-ES")}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Contactadas</p>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                    {kpi.total_contactadas.toLocaleString("es-ES")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            }
        />
    );
}

// ─── CHARTS SECTION ───────────────────────────────────────────────────────────

async function MinutosChartsSection({
    from, to, isAdmin, filters,
}: {
    from: string; to: string; isAdmin: boolean; filters: AnalyticsFilters;
}) {
    const tenantConfig = await getActiveTenantConfig();
    if (!tenantConfig) return null;

    const config = (tenantConfig.config || {}) as Record<string, unknown>;
    const savedCharts = config.charts_llamadas as ChartConfig[] || [];
    const mergedCharts = savedCharts.length > 0 ? savedCharts : DEFAULT_CHARTS_LLAMADAS;

    const chartData = await getDynamicChartSeries(mergedCharts, from, to, filters);

    return (
        <ChartManager
            tenant={tenantConfig}
            initialCharts={mergedCharts}
            data={chartData}
            isAdmin={isAdmin}
            configKey="charts_llamadas"
            filters={filters}
            title="Análisis de Llamadas"
        />
    );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function MinutosPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;
    const { from, to, filters } = parseFilters(params);
    const isAdmin = await getAdminStatus();

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
            <FilterBar />

            {/* KPI Cards */}
            <Suspense
                key={`min-kpis-${from}-${to}-${JSON.stringify(filters)}`}
                fallback={
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-6 mb-8">
                        {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
                    </div>
                }
            >
                <MinutosKpis from={from} to={to} isAdmin={isAdmin} filters={filters} />
            </Suspense>

            {/* Charts */}
            <Suspense
                key={`min-charts-${from}-${to}-${JSON.stringify(filters)}`}
                fallback={
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, i) => <ChartSkeleton key={i} />)}
                    </div>
                }
            >
                <MinutosChartsSection from={from} to={to} isAdmin={isAdmin} filters={filters} />
            </Suspense>
        </div>
    );
}
