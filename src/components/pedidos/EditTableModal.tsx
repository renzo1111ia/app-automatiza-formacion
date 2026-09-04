"use client";

import React, { useState } from "react";
import { Table, TableShape, Zone } from "@/types/pedidos";
import { X, Utensils, Users, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditTableModalProps {
  table?: Table | null; // If null, we are creating a new table
  zones: Zone[];
  onClose: () => void;
  onSave: (tableData: Partial<Table>) => void;
  onDelete?: (tableId: string) => void;
}

export const EditTableModal: React.FC<EditTableModalProps> = ({
  table,
  zones,
  onClose,
  onSave,
  onDelete,
}) => {
  const isEditing = Boolean(table);

  const [name, setName] = useState(table?.name || `Mesa ${Math.floor(Math.random() * 50) + 11}`);
  const [number, setNumber] = useState(table?.number || Math.floor(Math.random() * 50) + 11);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {isEditing ? `Editar ${table?.name}` : "Añadir Nueva Mesa"}
              </h3>
              <p className="text-xs text-slate-400">Configura nombre, capacidad, forma y zona</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Name & Number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Nombre / Identificador:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Número de Mesa:</label>
              <input
                type="number"
                value={number}
                onChange={(e) => setNumber(Number(e.target.value))}
                required
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Zone Selector */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Espacio / Zona del Local:</label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 capitalize"
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
            <label className="block text-slate-400 font-semibold mb-1">Capacidad (Comensales):</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={24}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-400 flex items-center gap-1 font-medium whitespace-nowrap">
                <Users className="h-4 w-4" /> pers.
              </span>
            </div>
          </div>

          {/* Shape Selector */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1.5">Forma en el Plano:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShape("round")}
                className={cn(
                  "p-3 rounded-xl border flex flex-col items-center gap-1 font-medium transition-all",
                  shape === "round"
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50"
                    : "bg-slate-800/40 text-slate-400 border-slate-700 hover:bg-slate-800"
                )}
              >
                <div className="w-6 h-6 rounded-full border-2 border-current" />
                <span>Circular</span>
              </button>

              <button
                type="button"
                onClick={() => setShape("square")}
                className={cn(
                  "p-3 rounded-xl border flex flex-col items-center gap-1 font-medium transition-all",
                  shape === "square"
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50"
                    : "bg-slate-800/40 text-slate-400 border-slate-700 hover:bg-slate-800"
                )}
              >
                <div className="w-6 h-6 rounded border-2 border-current" />
                <span>Cuadrada</span>
              </button>

              <button
                type="button"
                onClick={() => setShape("rectangle")}
                className={cn(
                  "p-3 rounded-xl border flex flex-col items-center gap-1 font-medium transition-all",
                  shape === "rectangle"
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50"
                    : "bg-slate-800/40 text-slate-400 border-slate-700 hover:bg-slate-800"
                )}
              >
                <div className="w-8 h-5 rounded border-2 border-current" />
                <span>Rectangular</span>
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-800">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (table) onDelete(table.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
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
