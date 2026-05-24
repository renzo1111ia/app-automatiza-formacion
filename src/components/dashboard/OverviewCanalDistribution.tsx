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
  const data = [
    { label: "Llamadas", value: kpi.total_llamadas },
    { label: "WhatsApp", value: kpi.total_whatsapp_conversaciones },
  ];

  return (
    <div
      role="img"
      aria-label={`Distribución por canal: ${kpi.total_llamadas} llamadas y ${kpi.total_whatsapp_conversaciones} conversaciones de WhatsApp. Web tracking en desarrollo.`}
    >
      <DonutChart title="Distribución por canal" data={data} centerLabel="Canales" />
      <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        Web tracking en desarrollo (disponible post-MVP)
      </p>
    </div>
  );
}
