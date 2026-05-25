import { DonutChart } from "@/components/charts/DashboardCharts";
import type { KpiGenerales } from "@/lib/actions/analytics";
import { Info } from "lucide-react";

/**
 * Sprint 2B — Distribución por canal (donut) cross-canal.
 * Decisión 24-05-2026: muestra 2 valores (llamadas + whatsapp) con nota
 * "Web tracking en desarrollo" porque web_widgets no trackea sesiones todavía.
 * Backlog post-MVP: tabla web_widget_sessions + ingesta.
 */
export function OverviewCanalDistribution({ kpi }: { kpi: KpiGenerales }) {
  const llamadas = kpi.total_llamadas;
  const whatsapp = kpi.total_whatsapp_conversaciones;
  const total = llamadas + whatsapp;

  // Filtrar valores 0: evita segmentos invisibles en el donut. Si todo es 0,
  // se renderiza el empty state (BUG-2B-03 fix).
  const data = [
    { label: "Llamadas", value: llamadas },
    { label: "WhatsApp", value: whatsapp },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div
        role="img"
        aria-label="Distribución por canal sin datos en el período seleccionado. Web tracking en desarrollo."
        className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <h3 className="text-foreground text-base font-bold">Distribución por canal</h3>
        <p className="text-muted-foreground text-sm">Sin datos en el período seleccionado</p>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Web tracking en desarrollo (disponible post-MVP)
        </p>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`Distribución por canal: ${llamadas} llamadas y ${whatsapp} conversaciones de WhatsApp. Web tracking en desarrollo.`}
      className="flex h-full flex-col"
    >
      <div className="flex-1">
        <DonutChart title="Distribución por canal" data={data} centerLabel="Canales" />
      </div>
      <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        Web tracking en desarrollo (disponible post-MVP)
      </p>
    </div>
  );
}
