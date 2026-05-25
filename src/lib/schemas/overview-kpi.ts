import { z } from "zod";

// Sprint 2B — Schema Zod para validar entradas de tenants.config.overview_kpis.
// Refleja la interface KpiConfig de src/types/tenant.ts (subset usado por OverviewSection).
// Validación runtime al cargar config del tenant en getKpiOverview().

export const OverviewKpiSizeEnum = z.enum(["3", "4", "6", "8", "9", "12"]);

export const OverviewKpiConfigSchema = z.object({
  id: z.string().min(1, "id requerido"),
  label: z.string().min(1, "label requerido").max(60, "label máx 60 chars"),
  icon: z.string().min(1, "icon requerido"),
  color: z.string().min(1, "color requerido"),
  size: OverviewKpiSizeEnum,
  staticKey: z.string().optional(),
  dynamicQuery: z.string().optional(),
  suffix: z.string().optional(),
  isVisible: z.boolean().optional().default(true),
  group: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
});

export const OverviewKpisArraySchema = z
  .array(OverviewKpiConfigSchema)
  .max(8, "Máximo 8 KPIs en Overview (UX hero section)");

export type OverviewKpiConfig = z.infer<typeof OverviewKpiConfigSchema>;
export type OverviewKpisArray = z.infer<typeof OverviewKpisArraySchema>;
