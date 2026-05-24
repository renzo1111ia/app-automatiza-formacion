// Sprint 2B — Pure mapper KpiGenerales → KpiOverviewOutput.
// Vive fuera de actions/ porque actions/analytics.ts es "use server"
// y Next.js exige funciones async en exports server-only.

import type { KpiGenerales } from "@/lib/actions/analytics";
import { KpiOverviewOutputSchema, type KpiOverviewOutput } from "@/lib/schemas/kpi-overview-io";

/**
 * Mapping puro: aplica safeDiv para tasas y arma el shape Overview.
 * canales.web=0 en MVP (web_widgets no trackea sesiones todavía;
 * frontend muestra tooltip "Web tracking en desarrollo" — decisión 24-05).
 */
export function mapKpiGeneralesToOverview(kpi: KpiGenerales): KpiOverviewOutput {
  // Cap a 100% para coherencia visual y respeto del schema (max 100).
  // Si numerador > denominador (race condition en ingesta), mostramos 100%
  // en vez de 150% (más legible para Bea, y consistente con bar/donut UX).
  const safeDiv = (n: number, d: number) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0);

  return KpiOverviewOutputSchema.parse({
    total_leads: kpi.total_leads,
    leads_alcanzados: kpi.total_leads_alcanzados,
    leads_contactados: kpi.total_contactados,
    leads_cualificados: kpi.total_cualificados,
    leads_agendados: kpi.total_agendados,
    tasa_contacto: safeDiv(kpi.total_contactados, kpi.total_leads),
    tasa_cualificacion: safeDiv(kpi.total_cualificados, kpi.total_leads),
    tasa_agendamiento: safeDiv(kpi.total_agendados, kpi.total_leads),
    tiempo_ahorrado_formateado: kpi.tiempo_ahorrado_formateado,
    horas_ahorradas: kpi.horas_ahorradas,
    canales: {
      llamadas: kpi.total_llamadas,
      whatsapp: kpi.total_whatsapp_conversaciones,
      web: 0, // TODO post-MVP: tabla web_widget_sessions + ingesta
    },
  });
}
