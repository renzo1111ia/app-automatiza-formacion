"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { KpiGenerales } from "@/lib/actions/analytics";
import { Info } from "lucide-react";

const PALETTE = ["#2563eb", "#f97316", "#10b981", "#8b5cf6"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TooltipPie({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border-border bg-card rounded-xl border px-4 py-3 text-xs shadow-xl">
      <p className="text-card-foreground font-bold">{payload[0].name}</p>
      <p className="font-black text-blue-600 dark:text-blue-400">
        {payload[0].value?.toLocaleString()} ({payload[0].payload?.pct}%)
      </p>
    </div>
  );
}

/**
 * Sprint 2B — Distribución por canal (donut) cross-canal.
 * Decisión 24-05-2026: muestra 2 valores (llamadas + whatsapp) con nota
 * "Web tracking en desarrollo" porque web_widgets no trackea sesiones todavía.
 * Backlog post-MVP: tabla web_widget_sessions + ingesta.
 *
 * Card replicada del ChartCard de DashboardCharts (mismas clases: rounded-3xl
 * p-7 shadow-sm) para que la altura quede alineada con los otros 3 charts del
 * grid 12-col del Overview. La nota "Web tracking en desarrollo" vive dentro
 * de la card en lugar de fuera (fix alineación visual 25-05).
 */
export function OverviewCanalDistribution({ kpi }: { kpi: KpiGenerales }) {
  const llamadas = kpi.total_llamadas;
  const whatsapp = kpi.total_whatsapp_conversaciones;
  const total = llamadas + whatsapp;

  const pieData = [
    { name: "Llamadas", value: llamadas },
    { name: "WhatsApp", value: whatsapp },
  ]
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, pct: total > 0 ? Math.round((d.value / total) * 100) : 0 }));

  return (
    <div
      role="img"
      aria-label={
        total === 0
          ? "Distribución por canal sin datos en el período seleccionado. Web tracking en desarrollo."
          : `Distribución por canal: ${llamadas} llamadas y ${whatsapp} conversaciones de WhatsApp. Web tracking en desarrollo.`
      }
      className="border-border bg-card flex h-full flex-col rounded-3xl border p-7 shadow-sm"
    >
      <h3 className="text-muted-foreground mb-6 text-sm font-black tracking-widest uppercase">
        Distribución por canal
      </h3>
      <div className="min-h-[260px] flex-1">
        {total === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-muted-foreground text-sm">Sin datos en el período seleccionado</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="40%"
                cy="50%"
                innerRadius={60}
                outerRadius={92}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                stroke="transparent"
                strokeWidth={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={`canal-${i}`} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<TooltipPie />} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={8}
                formatter={(val) => (
                  <span className="text-muted-foreground ml-1 text-xs font-bold">{val}</span>
                )}
              />
              <text
                x="40%"
                y="44%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground font-bold tracking-wider uppercase"
                fontSize={11}
              >
                Canales
              </text>
              <text
                x="40%"
                y="56%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground font-black"
                fontSize={20}
              >
                {total.toLocaleString()}
              </text>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        Web tracking en desarrollo (disponible post-MVP)
      </p>
    </div>
  );
}
