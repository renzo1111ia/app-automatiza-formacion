"use client";

import React, { useState } from "react";
import { Zone } from "@/types/pedidos";
import { X, Plus, Trash2, Layers, Check } from "lucide-react";

interface ZoneManagerModalProps {
  zones: Zone[];
  onClose: () => void;
  onAddZone: (newZone: Zone) => void;
  onDeleteZone: (zoneId: string) => void;
}

export const ZoneManagerModal: React.FC<ZoneManagerModalProps> = ({
  zones,
  onClose,
  onAddZone,
  onDeleteZone,
}) => {
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneDesc, setNewZoneDesc] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;

    const id = newZoneName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    onAddZone({
      id: `${id}_${Date.now()}`,
      name: newZoneName.trim(),
      description: newZoneDesc.trim() || "Espacio personalizado del local",
    });

    setNewZoneName("");
    setNewZoneDesc("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Gestionar Espacios & Zonas del Local</h3>
              <p className="text-xs text-slate-400">Crea o elimina ambientes (ej. Pub, Terraza, VIP, Salón 2)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-xs">
          {/* Add Zone Form */}
          <form onSubmit={handleAdd} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-purple-400" /> Crear Nuevo Espacio / Zona
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Nombre de la Zona:</label>
                <input
                  type="text"
                  placeholder="Ej. 🍺 Barra / Pub, 🍷 Cava"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Descripción (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ej. Zona de copas y taburetes altos"
                  value={newZoneDesc}
                  onChange={(e) => setNewZoneDesc(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 flex items-center gap-1 transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Añadir Zona
              </button>
            </div>
          </form>

          {/* Zones List */}
          <div>
            <h4 className="font-bold text-slate-300 text-xs mb-2">Zonas Configradas en el Establecimiento:</h4>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
              {zones.map((z) => (
                <div
                  key={z.id}
                  className="p-3 bg-slate-950/40 flex items-center justify-between gap-3 hover:bg-slate-900/60 transition-colors"
                >
                  <div>
                    <span className="font-bold text-white block text-sm">{z.name}</span>
                    {z.description && <span className="text-[11px] text-slate-400">{z.description}</span>}
                  </div>

                  {zones.length > 1 && (
                    <button
                      onClick={() => onDeleteZone(z.id)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Eliminar zona"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
