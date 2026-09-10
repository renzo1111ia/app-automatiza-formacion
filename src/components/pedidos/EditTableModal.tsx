"use client";

import React, { useState } from "react";
import { Table, TableShape, Zone } from "@/types/pedidos";
import { X, Utensils, Users, Check, Trash2, Copy, Layers, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditTableModalProps {
  table?: Table | null; // If null, we are creating a new table
  zones: Zone[];
  existingTables?: Table[]; // Para elegir plantilla al crear
  onClose: () => void;
  onSave: (tableData: Partial<Table>) => void;
  onDelete?: (tableId: string) => void;
  onDuplicate?: (table: Table) => void;
  onBatchCreate?: (count: number, templateData: Partial<Table>) => void; // Crear N mesas de una vez
}

export const EditTableModal: React.FC<EditTableModalProps> = ({
  table,
  zones,
  existingTables = [],
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  onBatchCreate,
}) => {
  const isEditing = Boolean(table);

  const [name, setName] = useState(table?.name || "Mesa Nueva");
  const [number, setNumber] = useState(table?.number || 1);
  const [capacity, setCapacity] = useState(table?.capacity || 4);
  const [shape, setShape] = useState<TableShape>(table?.shape || "square");
  const [zoneId, setZoneId] = useState(table?.zone || zones[0]?.id || "terraza");

  // Estado para la sección de plantilla (solo al crear)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [batchCount, setBatchCount] = useState<number>(1);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);

  // Aplica la configuración de la plantilla elegida
  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tpl = existingTables.find((t) => t.id === templateId);
    if (!tpl) return;
    setCapacity(tpl.capacity);
    setShape(tpl.shape);
    setZoneId(tpl.zone);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const baseData: Partial<Table> = {
      name,
      number: Number(number),
      capacity: Number(capacity),
      shape,
      zone: zoneId,
      status: table?.status || "disponible",
      position: table?.position || { x: 50, y: 50 },
    };

    if (!isEditing && batchCount > 1 && onBatchCreate) {
      // Modo lote: delegar la creación en lote al padre
      onBatchCreate(batchCount, baseData);
    } else {
      onSave({
        id: table?.id || `table-${Date.now()}`,
        ...baseData,
      });
    }
    onClose();
  };

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 p-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/20 p-2 text-indigo-400">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditing ? `Editar ${table?.name}` : "Añadir Nueva Mesa"}
              </h3>
              <p className="text-xs text-slate-400">Configura nombre, capacidad, forma y zona</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panel de Plantilla / Duplicado (solo al CREAR) */}
        {!isEditing && existingTables.length > 0 && (
          <div className="border-b border-slate-800 bg-slate-950/40 px-5 py-3">
            <button
              type="button"
              onClick={() => setShowTemplatePanel(!showTemplatePanel)}
              className="flex w-full items-center justify-between text-xs font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
            >
              <span className="flex items-center gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copiar configuración de una mesa existente
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  showTemplatePanel && "rotate-180"
                )}
              />
            </button>

            {showTemplatePanel && (
              <div className="mt-3 space-y-3">
                {/* Selector de plantilla */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                    Elegir mesa como plantilla:
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                    className="w-full rounded-lg border border-emerald-800/60 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">— Sin plantilla (desde cero) —</option>
                    {existingTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.capacity} pers. · {t.shape}
                      </option>
                    ))}
                  </select>
                  {selectedTemplateId && (
                    <p className="mt-1 text-[11px] text-emerald-400">
                      ✓ Capacidad, forma y zona copiadas. Ajusta el nombre si lo deseas.
                    </p>
                  )}
                </div>

                {/* Contador de lote */}
                {onBatchCreate && (
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                      <Layers className="mr-1 inline h-3 w-3 text-amber-400" />
                      Crear en lote (cuántas mesas iguales):
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                        <button
                          type="button"
                          onClick={() => setBatchCount(Math.max(1, batchCount - 1))}
                          className="px-3 py-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                        >
                          −
                        </button>
                        <span className="min-w-[2.5rem] text-center text-sm font-bold text-white">
                          {batchCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => setBatchCount(Math.min(20, batchCount + 1))}
                          className="px-3 py-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {batchCount === 1
                          ? "Se creará 1 mesa"
                          : `Se crearán ${batchCount} mesas consecutivas`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5 text-xs">
          {/* Name & Number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-400">
                Nombre / Identificador:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-400">Número de Mesa:</label>
              <input
                type="number"
                value={number}
                onChange={(e) => setNumber(Number(e.target.value))}
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Zone Selector */}
          <div>
            <label className="mb-1 block font-semibold text-slate-400">
              Espacio / Zona del Local:
            </label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white capitalize focus:border-indigo-500 focus:outline-none"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          {/* Capacity */}
          <div>
            <label className="mb-1 block font-semibold text-slate-400">
              Capacidad (Comensales):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={24}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-indigo-500 focus:outline-none"
              />
              <span className="flex items-center gap-1 font-medium whitespace-nowrap text-slate-400">
                <Users className="h-4 w-4" /> pers.
              </span>
            </div>
          </div>

          {/* Shape Selector */}
          <div>
            <label className="mb-1.5 block font-semibold text-slate-400">Forma en el Plano:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShape("round")}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-3 font-medium transition-all",
                  shape === "round"
                    ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                    : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-800"
                )}
              >
                <div className="h-6 w-6 rounded-full border-2 border-current" />
                <span>Circular</span>
              </button>

              <button
                type="button"
                onClick={() => setShape("square")}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-3 font-medium transition-all",
                  shape === "square"
                    ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                    : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-800"
                )}
              >
                <div className="h-6 w-6 rounded border-2 border-current" />
                <span>Cuadrada</span>
              </button>

              <button
                type="button"
                onClick={() => setShape("rectangle")}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-3 font-medium transition-all",
                  shape === "rectangle"
                    ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                    : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-800"
                )}
              >
                <div className="h-5 w-8 rounded border-2 border-current" />
                <span>Rectangular</span>
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
            {isEditing && (onDelete || onDuplicate) ? (
              <div className="flex items-center gap-2">
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (table) onDelete(table.id);
                      onClose();
                    }}
                    className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/20 px-3 py-2 font-semibold text-rose-300 transition-colors hover:bg-rose-500/30"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </button>
                )}
                {onDuplicate && table && (
                  <button
                    type="button"
                    onClick={() => {
                      onDuplicate(table);
                      onClose();
                    }}
                    className="flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 py-2 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30"
                    title="Duplicar esta mesa con toda su configuración"
                  >
                    <Copy className="h-4 w-4" /> Duplicar
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
              >
                <Check className="h-4 w-4" />
                {isEditing
                  ? "Guardar"
                  : batchCount > 1
                    ? `Crear ${batchCount} Mesas`
                    : "Crear Mesa"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
