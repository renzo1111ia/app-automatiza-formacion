"use client";

import React, { useState } from "react";
import { Table, TableShape, Zone } from "@/types/pedidos";
import { X, Utensils, Users, Check, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditTableModalProps {
  table?: Table | null; // If null, we are creating a new table
  zones: Zone[];
  onClose: () => void;
  onSave: (tableData: Partial<Table>) => void;
  onDelete?: (tableId: string) => void;
  onDuplicate?: (table: Table) => void;
}

export const EditTableModal: React.FC<EditTableModalProps> = ({
  table,
  zones,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
}) => {
  const isEditing = Boolean(table);

  const [name, setName] = useState(table?.name || "Mesa Nueva");
  const [number, setNumber] = useState(table?.number || 1);
  const [capacity, setCapacity] = useState(table?.capacity || 4);
  const [shape, setShape] = useState<TableShape>(table?.shape || "square");
  const [zoneId, setZoneId] = useState(table?.zone || zones[0]?.id || "terraza");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: table?.id || `table-${Date.now()}`,
      name,
      number: Number(number),
      capacity: Number(capacity),
      shape,
      zone: zoneId,
      status: table?.status || "disponible",
      position: table?.position || { x: 50, y: 50 },
    });
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
                <Check className="h-4 w-4" /> {isEditing ? "Guardar" : "Crear Mesa"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
