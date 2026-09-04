"use client";

import React, { useState, useRef } from "react";
import { Table, TableStatus, Reservation, Zone } from "@/types/pedidos";
import { Users, Bot, MessageSquare, PhoneCall, Globe, Sparkles, Edit2, Trash2, Move } from "lucide-react";
import { cn } from "@/lib/utils";

interface TablesCanvasProps {
  tables: Table[];
  reservations: Record<string, Reservation>;
  zones: Zone[];
  selectedZone: string;
  isEditMode: boolean;
  onSelectTable: (table: Table) => void;
  onEditTable: (table: Table) => void;
  onDeleteTable: (tableId: string) => void;
  onUpdateTablePosition: (tableId: string, position: { x: number; y: number }) => void;
}

const STATUS_CONFIG: Record<
  TableStatus,
  { label: string; bgClass: string; textClass: string; borderClass: string; dotClass: string }
> = {
  disponible: {
    label: "Disponible",
    bgClass: "bg-emerald-500/10 hover:bg-emerald-500/20",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/40 hover:border-emerald-400",
    dotClass: "bg-emerald-500 shadow-emerald-500/50",
  },
  reservada: {
    label: "Reservada (IA)",
    bgClass: "bg-amber-500/15 hover:bg-amber-500/25",
    textClass: "text-amber-300",
    borderClass: "border-amber-500/50 hover:border-amber-400",
    dotClass: "bg-amber-400 shadow-amber-400/50 animate-pulse",
  },
  ocupada: {
    label: "Ocupada",
    bgClass: "bg-rose-500/15 hover:bg-rose-500/25",
    textClass: "text-rose-400",
    borderClass: "border-rose-500/50 hover:border-rose-400",
    dotClass: "bg-rose-500 shadow-rose-500/50",
  },
  mantenimiento: {
    label: "Mantenimiento",
    bgClass: "bg-slate-700/20 hover:bg-slate-700/30",
    textClass: "text-slate-400",
    borderClass: "border-slate-600/40",
    dotClass: "bg-slate-500",
  },
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />,
  voice: <PhoneCall className="h-3.5 w-3.5 text-blue-400" />,
  web: <Globe className="h-3.5 w-3.5 text-violet-400" />,
  manual: <Users className="h-3.5 w-3.5 text-slate-400" />,
};

export const TablesCanvas: React.FC<TablesCanvasProps> = ({
  tables,
  reservations,
  zones,
  selectedZone,
  isEditMode,
  onSelectTable,
  onEditTable,
  onDeleteTable,
  onUpdateTablePosition,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);

  const filteredTables =
    selectedZone === "all" ? tables : tables.filter((t) => t.zone === selectedZone);

  // Handle Dragging in Edit Mode
  const handleMouseDown = (tableId: string, e: React.MouseEvent) => {
    if (!isEditMode) return;
    e.stopPropagation();
    setDraggingTableId(tableId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isEditMode || !draggingTableId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp coordinates within 5% to 95%
    const clampedX = Math.max(5, Math.min(95, Math.round(rawX)));
    const clampedY = Math.max(5, Math.min(95, Math.round(rawY)));

    onUpdateTablePosition(draggingTableId, { x: clampedX, y: clampedY });
  };

  const handleMouseUp = () => {
    if (draggingTableId) {
      setDraggingTableId(null);
    }
  };

  const activeZoneObj = zones.find((z) => z.id === selectedZone);

  return (
    <div
      className={cn(
        "relative w-full rounded-2xl border transition-colors bg-slate-950/90 p-6 shadow-2xl backdrop-blur-md overflow-hidden min-h-[600px] flex flex-col justify-between select-none",
        isEditMode ? "border-amber-500/50 bg-slate-950/95" : "border-slate-800"
      )}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid Pattern Background */}
      <div
        className={cn(
          "absolute inset-0 bg-[size:32px_32px] pointer-events-none transition-opacity",
          isEditMode
            ? "bg-[linear-gradient(to_right,#f59e0b25_1px,transparent_1px),linear-gradient(to_bottom,#f59e0b25_1px,transparent_1px)] opacity-100"
            : "bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] opacity-80"
        )}
      />

      {/* Header Info & Edit Mode Alert Banner */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white tracking-wide">
              {selectedZone === "all" ? "Plano General del Local" : activeZoneObj?.name || "Espacio"}
            </h3>
            {isEditMode ? (
              <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold animate-pulse flex items-center gap-1">
                <Move className="h-3.5 w-3.5" /> Modo Edición Activo
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-medium">
                Canvas Interactivo
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isEditMode
              ? "Arrastra cualquier mesa para cambiar su posición en el mapa o utiliza los iconos para editar capacidad y forma."
              : activeZoneObj?.description || "Vista interactiva en tiempo real"}
          </p>
        </div>

        {/* Legend */}
        {!isEditMode && (
          <div className="flex items-center gap-4 text-xs bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              Disponible
            </div>
            <div className="flex items-center gap-1.5 text-amber-300 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 animate-pulse" />
              Reservada (IA)
            </div>
            <div className="flex items-center gap-1.5 text-rose-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              Ocupada
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Canvas Container */}
      <div
        ref={canvasRef}
        className={cn(
          "relative z-10 flex-1 min-h-[480px] w-full rounded-xl border p-4 overflow-hidden transition-all",
          isEditMode
            ? "bg-slate-900/70 border-amber-500/30 cursor-crosshair"
            : "bg-slate-900/40 border-slate-800/60"
        )}
      >
        {/* Render Decorative Zone Labels when displaying all zones */}
        {selectedZone === "all" &&
          zones.map((zone, idx) => (
            <div
              key={zone.id}
              style={{ top: `${idx * 24 + 4}%` }}
              className="absolute left-4 text-[10px] uppercase font-bold tracking-widest text-indigo-400/30 pointer-events-none select-none"
            >
              {zone.name}
            </div>
          ))}

        {/* Interactive Tables */}
        {filteredTables.map((table) => {
          const res = table.currentReservationId ? reservations[table.currentReservationId] : null;
          const statusCfg = STATUS_CONFIG[table.status];

          const isRound = table.shape === "round";
          const isRect = table.shape === "rectangle";
          const isDragging = draggingTableId === table.id;

          return (
            <div
              key={table.id}
              onMouseDown={(e) => handleMouseDown(table.id, e)}
              onClick={() => {
                if (!isEditMode) onSelectTable(table);
              }}
              style={{
                left: `${table.position.x}%`,
                top: `${table.position.y}%`,
              }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 transition-all group flex flex-col items-center justify-center p-3 border-2 shadow-lg backdrop-blur-md",
                isEditMode ? "cursor-grab active:cursor-grabbing border-dashed border-amber-400" : "cursor-pointer",
                isDragging ? "scale-110 z-40 border-amber-300 shadow-2xl bg-amber-500/20" : "",
                isRound ? "rounded-full w-24 h-24" : isRect ? "rounded-xl w-32 h-20" : "rounded-xl w-24 h-24",
                statusCfg.bgClass,
                statusCfg.borderClass
              )}
            >
              {/* Table Number & Name */}
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn("w-2 h-2 rounded-full", statusCfg.dotClass)} />
                <span className="text-xs font-bold text-white group-hover:scale-105 transition-transform">
                  {table.name}
                </span>
              </div>

              {/* Capacity info */}
              <div className="flex items-center gap-1 text-[11px] text-slate-300 font-medium">
                <Users className="h-3 w-3 text-slate-400" />
                <span>{res?.guestsCount || table.capacity} pers.</span>
              </div>

              {/* AI reservation badge if available */}
              {!isEditMode && res && (
                <div className="mt-1 flex items-center gap-1 text-[10px] bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-800 text-slate-200">
                  {CHANNEL_ICONS[res.createdVia]}
                  <span className="truncate max-w-[70px] font-semibold">{res.customer.name.split(" ")[0]}</span>
                </div>
              )}

              {/* Edit Mode Quick Action Overlays */}
              {isEditMode && (
                <div className="absolute -top-3 -right-3 flex items-center gap-1 z-30">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTable(table);
                    }}
                    className="p-1.5 rounded-full bg-indigo-600 text-white shadow hover:bg-indigo-500 transition-colors"
                    title="Editar mesa"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTable(table.id);
                    }}
                    className="p-1.5 rounded-full bg-rose-600 text-white shadow hover:bg-rose-500 transition-colors"
                    title="Eliminar mesa"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Hover Popover Tooltip (Normal Mode Only) */}
              {!isEditMode && (
                <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col w-56 p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-xs text-white z-50 pointer-events-none transition-all duration-200">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-1.5">
                    <span className="font-bold text-indigo-300">{table.name}</span>
                    <span className={cn("px-1.5 py-0.5 text-[10px] rounded font-semibold", statusCfg.textClass)}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {res ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Cliente:</span>
                        <span className="font-medium text-white">{res.customer.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Hora / Comensales:</span>
                        <span>{res.dateTime} ({res.guestsCount}p)</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20">
                        <Sparkles className="h-3 w-3 flex-shrink-0 text-emerald-400" />
                        <span className="line-clamp-2">{res.iaSummary.summary}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">Mesa sin reserva. Haz clic para asignar cliente o abrir pedido.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-indigo-400" />
          <span>
            {isEditMode
              ? "Arrastra cualquier mesa para recolocarla en el mapa. Pulsa en 'Finalizar Edición' cuando termines."
              : "Las reservas con distintivo de IA provienen de conversaciones automatizadas."}
          </span>
        </div>
      </div>
    </div>
  );
};
