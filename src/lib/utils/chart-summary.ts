// Sprint 2B phase-06 — WCAG 2.2 AA preventivo (criterion 1.1.1 + 4.1.2).
// Genera resumen textual de un dataset de chart para usar como aria-label.
// Screen readers podrán anunciar contenido del gráfico aunque sea visual.

import type { ChartRow } from "@/lib/actions/analytics";

/**
 * summarizeChartData: 1-2 frases describiendo el dataset.
 * - Si vacío: "Gráfico sin datos disponibles".
 * - Si tiene datos: "N puntos. Total: X. Máximo: <label> con Y."
 */
export function summarizeChartData(data: ChartRow[] | undefined | null): string {
  if (!data || data.length === 0) return "Gráfico sin datos disponibles";

  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const max = data.reduce((m, d) => (Number(d.value) > Number(m.value) ? d : m), data[0]);

  const points = data.length === 1 ? "1 punto de datos" : `${data.length} puntos de datos`;
  return `${points}. Total: ${total}. Máximo: ${max.label} con ${max.value}.`;
}
