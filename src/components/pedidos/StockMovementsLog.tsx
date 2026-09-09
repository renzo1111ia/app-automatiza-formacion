"use client";

import React, { useState } from "react";
import { StockMovement, StockMovementType } from "@/types/pedidos";
import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  RotateCcw,
  AlertOctagon,
  Filter,
  Search,
} from "lucide-react";

interface StockMovementsLogProps {
  movements: StockMovement[];
}

export const StockMovementsLog: React.FC<StockMovementsLogProps> = ({ movements }) => {
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = movements.filter((m) => {
    const matchesType = filterType === "all" || m.movementType === filterType;
    const matchesSearch =
      search === "" ||
      (m.ingredientName && m.ingredientName.toLowerCase().includes(search.toLowerCase())) ||
      (m.reason && m.reason.toLowerCase().includes(search.toLowerCase())) ||
      (m.reservationId && m.reservationId.toLowerCase().includes(search.toLowerCase())) ||
      (m.orderId && m.orderId.toLowerCase().includes(search.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const getBadge = (type: StockMovementType) => {
    switch (type) {
      case "venta":
        return (
          <span className="flex items-center gap-1 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-400">
            <ArrowDownLeft className="h-3 w-3" /> Venta (Servido)
          </span>
        );
      case "reposicion":
        return (
          <span className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
            <ArrowUpRight className="h-3 w-3" /> Reposición
          </span>
        );
      case "merma":
        return (
          <span className="flex items-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-400">
            <AlertOctagon className="h-3 w-3" /> Merma / Desecho
          </span>
        );
      case "ajuste_manual":
      default:
        return (
          <span className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
            <RotateCcw className="h-3 w-3" /> Ajuste Manual
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Search & Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por insumo, motivo o referencia de pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pr-4 pl-10 text-xs text-white transition-colors focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1">
          <button
            onClick={() => setFilterType("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterType === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType("venta")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterType === "venta" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Ventas
          </button>
          <button
            onClick={() => setFilterType("reposicion")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterType === "reposicion"
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Reposiciones
          </button>
          <button
            onClick={() => setFilterType("merma")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterType === "merma" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Mermas
          </button>
        </div>
      </div>

      {/* Movements Table */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/90 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3">Fecha y Hora</th>
                <th className="px-4 py-3">Insumo</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Motivo / Detalle</th>
                <th className="px-4 py-3">Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No hay movimientos registrados para este filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const dateFormatted = new Date(m.createdAt).toLocaleString("es-CL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isPositive = m.quantity > 0;

                  return (
                    <tr key={m.id} className="transition-colors hover:bg-slate-900/40">
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {dateFormatted}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {m.ingredientName || "Insumo"}
                      </td>
                      <td className="px-3 py-3">{getBadge(m.movementType)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-mono font-bold ${
                            isPositive ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-300">
                        {m.reason || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {m.reservationId ? (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-indigo-300">
                            #{m.reservationId}
                          </span>
                        ) : m.orderId ? (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-emerald-300">
                            #{m.orderId}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
