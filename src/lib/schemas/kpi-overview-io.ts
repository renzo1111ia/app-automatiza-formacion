import { z } from "zod";

// Sprint 2B — IO schemas para getKpiOverview() server action.
// Input: rango + filtros (subset de AnalyticsFilters).
// Output: shape consumido por <OverviewSection> de /dashboard.
// Decisión 24-05: canales.web=0 con TODO (web_widgets no trackea sesiones todavía;
// frontend muestra tooltip "Web tracking en desarrollo").

export const KpiOverviewInputSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "from debe ser YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "to debe ser YYYY-MM-DD"),
  filters: z
    .object({
      pais: z.string().optional(),
      origen: z.string().optional(),
      campana: z.string().optional(),
      tipoLead: z.string().optional(),
    })
    .optional()
    .default({}),
});

export const KpiOverviewOutputSchema = z.object({
  total_leads: z.number().int().nonnegative(),
  leads_alcanzados: z.number().int().nonnegative(),
  leads_contactados: z.number().int().nonnegative(),
  leads_cualificados: z.number().int().nonnegative(),
  leads_agendados: z.number().int().nonnegative(),
  tasa_contacto: z.number().min(0).max(100),
  tasa_cualificacion: z.number().min(0).max(100),
  tasa_agendamiento: z.number().min(0).max(100),
  tiempo_ahorrado_formateado: z.string(),
  horas_ahorradas: z.number().nonnegative(),
  canales: z.object({
    llamadas: z.number().int().nonnegative(),
    whatsapp: z.number().int().nonnegative(),
    web: z.number().int().nonnegative(), // Siempre 0 en MVP — ver decisión 24-05
  }),
});

export type KpiOverviewInput = z.infer<typeof KpiOverviewInputSchema>;
export type KpiOverviewOutput = z.infer<typeof KpiOverviewOutputSchema>;
