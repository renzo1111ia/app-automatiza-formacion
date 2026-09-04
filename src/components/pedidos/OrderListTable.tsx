"use client";

import React, { useState } from "react";
import { Table, Reservation, TableStatus } from "@/types/pedidos";
import { Search, Filter, MessageSquare, PhoneCall, Globe, User, Utensils, Eye, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

import { formatCLP } from "@/lib/mock-pedidos-data";

interface OrderListTableProps {
  tables: Table[];
  reservations: Record<string, Reservation>;
  onSelectTable: (table: Table) => void;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  whatsapp: <span className="flex items-center gap-1 text-emerald-400"><MessageSquare className="h-3.5 w-3.5" /> WhatsApp</span>,
  voice: <span className="flex items-center gap-1 text-blue-400"><PhoneCall className="h-3.5 w-3.5" /> Voz AI</span>,
  web: <span className="flex items-center gap-1 text-purple-400"><Globe className="h-3.5 w-3.5" /> Web Chat</span>,
  manual: <span className="flex items-center gap-1 text-slate-400"><User className="h-3.5 w-3.5" /> Manual</span>,
};

const STATUS_BADGES: Record<TableStatus, { label: string; bg: string }> = {
  disponible: { label: "Disponible", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  reservada: { label: "Reservada (IA)", bg: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  ocupada: { label: "Ocupada", bg: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  mantenimiento: { label: "Mantenimiento", bg: "bg-slate-700/20 text-slate-400 border-slate-700" },
};

export const OrderListTable: React.FC<OrderListTableProps> = ({
  tables,
  reservations,
  onSelectTable,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredTables = tables.filter((table) => {
    const res = table.currentReservationId ? reservations[table.currentReservationId] : null;
    const matchesSearch =
      search === "" ||
      table.name.toLowerCase().includes(search.toLowerCase()) ||
      (res && res.customer.name.toLowerCase().includes(search.toLowerCase())) ||
      (res && res.customer.phone.includes(search));

    const matchesStatus = statusFilter === "all" || table.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-md space-y-4">
      {/* Search & Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por mesa, cliente o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            {["all", "disponible", "reservada", "ocupada"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-all capitalize",
                  statusFilter === st
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {st === "all" ? "Todas" : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table List View */}
      <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4">Mesa / Ubicación</th>
              <th className="py-3.5 px-4">Estado</th>
              <th className="py-3.5 px-4">Cliente / Contacto</th>
              <th className="py-3.5 px-4">Canal Origen IA</th>
              <th className="py-3.5 px-4">Hora / Comensales</th>
              <th className="py-3.5 px-4">Total Consumo</th>
              <th className="py-3.5 px-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
            {filteredTables.map((table) => {
              const res = table.currentReservationId ? reservations[table.currentReservationId] : null;
              const statusCfg = STATUS_BADGES[table.status];

              return (
                <tr
                  key={table.id}
                  onClick={() => onSelectTable(table)}
                  className="hover:bg-slate-900/70 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-300">
                        #{table.number}
                      </div>
                      <div>
                        <span className="font-bold text-white block">{table.name}</span>
                        <span className="text-[11px] text-slate-400 capitalize">{table.zone.replace("_", " ")}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold border", statusCfg.bg)}>
                      {statusCfg.label}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    {res ? (
                      <div>
                        <span className="font-semibold text-white block">{res.customer.name}</span>
                        <span className="text-[11px] text-slate-400">{res.customer.phone}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Sin asignación</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-medium">
                    {res ? CHANNEL_ICONS[res.createdVia] : <span className="text-slate-600">-</span>}
                  </td>

                  <td className="py-3.5 px-4">
                    {res ? (
                      <span className="text-slate-300 font-medium">
                        {res.dateTime} <span className="text-slate-500">({res.guestsCount}p)</span>
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-bold text-emerald-400">
                    {res && res.totalAmount > 0 ? formatCLP(res.totalAmount) : <span className="text-slate-600">$0</span>}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 group-hover:text-white transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
