"use client";

import { ReactNode } from "react";
import { KpiConfig } from "@/types/tenant";
import { Plus, Trash2, Activity, Settings2, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  kpis: KpiConfig[];
  onChange: (kpis: KpiConfig[]) => void;
}

export function KpiBuilder({ kpis, onChange }: Props) {
  function handleAdd() {
    const newKpi: KpiConfig = {
      id: Math.random().toString(36).substr(2, 9),
      label: "Nuevo KPI",
      icon: "Phone",
      color: "bg-blue-600",
      size: "4",
      calcType: "count",
      targetCol: "",
      isExtraTarget: false,
    };
    onChange([...kpis, newKpi]);
  }

  function handleRemove(id: string) {
    onChange(kpis.filter((k) => k.id !== id));
  }

  function updateKpi(id: string, updates: Partial<KpiConfig>) {
    onChange(kpis.map((k) => (k.id === id ? { ...k, ...updates } : k)));
  }

  // List of accepted Tailwind bg colors
  const COLORS = [
    "bg-blue-600",
    "bg-emerald-600",
    "bg-red-600",
    "bg-indigo-600",
    "bg-orange-600",
    "bg-rose-600",
    "bg-amber-600",
    "bg-pink-600",
    "bg-slate-600",
    "bg-yellow-600",
    "bg-teal-600",
    "bg-purple-600",
    "bg-cyan-600",
  ];

  if (!kpis) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-black tracking-[0.1em] text-slate-500 uppercase">
          Módulos de Panel Dinámicos
        </Label>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar KPI
        </button>
      </div>

      {kpis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <Activity className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-xs font-bold text-slate-400">
            No hay KPIs personalizados configurados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {kpis.map((kpi, index) => (
            <div
              key={kpi.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              {/* KPI Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className={cn("h-4 w-4 rounded-sm", kpi.color)} />
                  <h4 className="text-xs font-black tracking-widest text-slate-700 uppercase">
                    Bloque #{index + 1}
                  </h4>
                </div>
                <button
                  type="button"
                  title="Eliminar"
                  aria-label="Eliminar"
                  onClick={() => handleRemove(kpi.id)}
                  className="text-slate-400 transition-colors hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* KPI Body */}
              <div className="space-y-5 p-4">
                {/* Row 1: Visuals */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">
                      Título visible
                    </label>
                    <input
                      type="text"
                      value={kpi.label}
                      onChange={(e) => updateKpi(kpi.id, { label: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                      placeholder="Ej: Llamadas de Ventas"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase">
                      Color (Fondo)
                    </label>
                    <select
                      title="Color"
                      value={kpi.color}
                      onChange={(e) => updateKpi(kpi.id, { color: e.target.value })}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none"
                    >
                      {COLORS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase">
                      Ancho en Tablero
                    </label>
                    <select
                      title="Tamaño"
                      value={kpi.size}
                      onChange={(e) =>
                        updateKpi(kpi.id, { size: e.target.value as KpiConfig["size"] })
                      }
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none"
                    >
                      <option value="3">Chico (1/4)</option>
                      <option value="4">Mediano (1/3)</option>
                      <option value="6">Grande (1/2)</option>
                      <option value="12">Completo</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Operation */}
                <div className="space-y-3 rounded-xl border border-blue-100/50 bg-blue-50/50 p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Settings2 className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase">
                      Lógica Matemática
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">
                        Operación
                      </label>
                      <select
                        title="Operación"
                        value={kpi.calcType}
                        onChange={(e) =>
                          updateKpi(kpi.id, { calcType: e.target.value as KpiConfig["calcType"] })
                        }
                        className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-900 outline-none"
                      >
                        <option value="count">Contar (* o Registros)</option>
                        <option value="sum">Sumar (Totales)</option>
                        <option value="avg">Promedio (Media)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">
                        Columna a calcular
                      </label>
                      <input
                        type="text"
                        value={kpi.targetCol}
                        onChange={(e) => updateKpi(kpi.id, { targetCol: e.target.value })}
                        className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-900 outline-none"
                        placeholder="Ej: * (todo) o Total Mins"
                      />
                    </div>
                    <div className="space-y-1.5 pt-5 md:col-span-2">
                      <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={kpi.isExtraTarget}
                          onChange={(e) => updateKpi(kpi.id, { isExtraTarget: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-blue-300 text-blue-600"
                        />
                        ¿La columna está dentro de los cabezales dinámicos (Extra Data)?
                      </label>
                    </div>
                  </div>
                </div>

                {/* Row 3: Condition (Optional) */}
                <div className="space-y-3 rounded-xl border border-amber-100/50 bg-amber-50/50 p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[10px] font-black tracking-widest text-amber-600 uppercase">
                      Condición Opcional (Filtro Interno)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">
                        Si la columna:
                      </label>
                      <input
                        type="text"
                        value={kpi.condCol || ""}
                        onChange={(e) => updateKpi(kpi.id, { condCol: e.target.value })}
                        className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-900 outline-none placeholder:text-amber-200"
                        placeholder="Ej: is_qualified o campana..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Es:</label>
                      <select
                        title="Condición"
                        value={kpi.condOp || "="}
                        onChange={(e) =>
                          updateKpi(kpi.id, { condOp: e.target.value as KpiConfig["condOp"] })
                        }
                        className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-[11px] font-black text-amber-700 outline-none"
                      >
                        <option value="=">=</option>
                        <option value="!=">!=</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value="ILIKE">Criterio Like</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">
                        Al valor:
                      </label>
                      <input
                        type="text"
                        value={kpi.condVal || ""}
                        onChange={(e) => updateKpi(kpi.id, { condVal: e.target.value })}
                        className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-900 outline-none"
                        placeholder="Ej: true, NO_CONTACT..."
                      />
                    </div>
                    <div className="md:col-span-5">
                      <label className="flex cursor-pointer items-center gap-2 text-[10px] font-bold text-amber-900/60">
                        <input
                          type="checkbox"
                          checked={kpi.isExtraCond || false}
                          onChange={(e) => updateKpi(kpi.id, { isExtraCond: e.target.checked })}
                          className="h-3 w-3 rounded border-amber-300 text-amber-600"
                        />
                        ¿La columna de condición es dinámica (Extra Data)?
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={cn("block text-sm font-medium", className)}>{children}</label>;
}
