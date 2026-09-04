"use client";

import React, { useState } from "react";
import { Table, Reservation, TableStatus, OrderStatus, OrderItem } from "@/types/pedidos";
import {
  X,
  Bot,
  User,
  Phone,
  Calendar,
  Utensils,
  Clock,
  Sparkles,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  MessageSquare,
  PhoneCall,
  Globe,
  Tag,
  DollarSign,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { formatCLP } from "@/lib/mock-pedidos-data";

interface TableDetailModalProps {
  table: Table | null;
  reservation: Reservation | null;
  onClose: () => void;
  onUpdateStatus: (tableId: string, status: TableStatus) => void;
  onSaveReservation: (reservation: Reservation) => void;
}

const MENU_PRESETS = [
  { name: "Ensalada Burrata", category: "entrante", price: 14500 },
  { name: "Tabla de Ibéricos", category: "entrante", price: 22000 },
  { name: "Solomillo de Ternera", category: "principal", price: 24000 },
  { name: "Paella de Marisco", category: "principal", price: 32000 },
  { name: "Chuletón Madurado", category: "principal", price: 58000 },
  { name: "Tarta de Queso", category: "postre", price: 7500 },
  { name: "Vino Reserva Especial", category: "bebida", price: 21000 },
  { name: "Jarra de Sangría (1.5L)", category: "bebida", price: 16000 },
];

export const TableDetailModal: React.FC<TableDetailModalProps> = ({
  table,
  reservation,
  onClose,
  onUpdateStatus,
  onSaveReservation,
}) => {
  if (!table) return null;

  const [currentStatus, setCurrentStatus] = useState<TableStatus>(table.status);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(
    reservation?.orderStatus || "pendiente"
  );
  const [items, setItems] = useState<OrderItem[]>(reservation?.items || []);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const calculateTotal = (currentItems: OrderItem[]) => {
    return currentItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  };

  const handleAddItem = (preset: { name: string; category: string; price: number }) => {
    const newItem: OrderItem = {
      id: `item-${Date.now()}`,
      name: preset.name,
      category: preset.category as any,
      quantity: 1,
      unitPrice: preset.price,
    };
    const updated = [...items, newItem];
    setItems(updated);
    if (reservation) {
      onSaveReservation({
        ...reservation,
        items: updated,
        totalAmount: calculateTotal(updated),
      });
    }
  };

  const handleRemoveItem = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    if (reservation) {
      onSaveReservation({
        ...reservation,
        items: updated,
        totalAmount: calculateTotal(updated),
      });
    }
  };

  const handleStatusChange = (newStatus: TableStatus) => {
    setCurrentStatus(newStatus);
    onUpdateStatus(table.id, newStatus);
  };

  const channelBadge = (channel?: string) => {
    switch (channel) {
      case "whatsapp":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp AI
          </span>
        );
      case "voice":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <PhoneCall className="h-3.5 w-3.5" /> Agente de Voz AI
          </span>
        );
      case "web":
        return (
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Globe className="h-3.5 w-3.5" /> Chatbot Web
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-700 text-slate-300">
            <User className="h-3.5 w-3.5" /> Manual
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 backdrop-blur-sm p-4 md:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
              #{table.number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{table.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                  {table.zone === "terraza" ? "Terraza" : table.zone === "vip" ? "Zona VIP" : "Salón Principal"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Capacidad: {table.capacity} comensales</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Status Control Buttons */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
              Estado de la Mesa
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleStatusChange("disponible")}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5",
                  currentStatus === "disponible"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10"
                    : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800"
                )}
              >
                <Check className="h-3.5 w-3.5" /> Disponible
              </button>

              <button
                onClick={() => handleStatusChange("reservada")}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5",
                  currentStatus === "reservada"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10"
                    : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800"
                )}
              >
                <Clock className="h-3.5 w-3.5" /> Reservada
              </button>

              <button
                onClick={() => handleStatusChange("ocupada")}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5",
                  currentStatus === "ocupada"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md shadow-rose-500/10"
                    : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800"
                )}
              >
                <Utensils className="h-3.5 w-3.5" /> Ocupada
              </button>
            </div>
          </div>

          {/* AI SUMMARY CARD ("Lo que habló con la IA") */}
          {reservation ? (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/15 p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                <Bot className="w-32 h-32 text-indigo-400" />
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Resumen de Conversación con IA</h3>
                    <p className="text-[11px] text-indigo-300">{reservation.iaSummary.aiAgentName}</p>
                  </div>
                </div>
                {channelBadge(reservation.createdVia)}
              </div>

              {/* Summary details */}
              <div className="space-y-3 mt-4 text-xs">
                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-200 font-normal leading-relaxed">
                  "{reservation.iaSummary.summary}"
                </div>

                {/* Key Topics & Tags */}
                {reservation.iaSummary.keyTopics && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[11px] text-slate-400 font-medium mr-1">Temas clave:</span>
                    {reservation.iaSummary.keyTopics.map((topic, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 border border-slate-700 text-indigo-300 font-medium"
                      >
                        #{topic}
                      </span>
                    ))}
                  </div>
                )}

                {/* Dietary Restrictions & Special Requests */}
                {(reservation.iaSummary.dietaryRestrictions || reservation.iaSummary.specialRequests) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    {reservation.iaSummary.dietaryRestrictions && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block text-[11px]">Restricciones alimentarias:</span>
                          <span className="text-[11px]">{reservation.iaSummary.dietaryRestrictions.join(", ")}</span>
                        </div>
                      </div>
                    )}

                    {reservation.iaSummary.specialRequests && (
                      <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-start gap-2">
                        <Tag className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block text-[11px]">Petición especial:</span>
                          <span className="text-[11px]">{reservation.iaSummary.specialRequests}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center">
              <Bot className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">Esta mesa no tiene una reserva activa asociada</p>
              <p className="text-xs text-slate-500 mt-1">
                Puedes cambiar el estado arriba a "Reservada" u "Ocupada" para asignarle un cliente.
              </p>
            </div>
          )}

          {/* CUSTOMER INFORMATION */}
          {reservation && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-slate-400" /> Datos del Cliente
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Nombre del titular:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-semibold text-white text-sm">{reservation.customer.name}</span>
                    {reservation.customer.isVip && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                        ★ VIP
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block">Contacto:</span>
                  <span className="font-medium text-slate-300 mt-0.5 block flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-400" /> {reservation.customer.phone}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Fecha y Hora:</span>
                  <span className="font-medium text-slate-300 mt-0.5 block flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" /> {reservation.dateTime}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Comensales:</span>
                  <span className="font-medium text-slate-300 mt-0.5 block">
                    {reservation.guestsCount} personas
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ORDER ITEMS & BILLING SECTION */}
          {reservation && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-indigo-400" /> Pedido y Consumo
                </h3>

                <button
                  onClick={() => setShowPresetMenu(!showPresetMenu)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar Plato
                </button>
              </div>

              {/* Preset Menu Selector */}
              {showPresetMenu && (
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 space-y-2 animate-in fade-in">
                  <span className="text-[11px] font-semibold text-slate-300 block">
                    Selecciona un plato del menú rápido:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {MENU_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAddItem(preset)}
                        className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 flex justify-between items-center text-slate-200 transition-colors"
                      >
                        <span className="truncate">{preset.name}</span>
                        <span className="font-bold text-emerald-400">{formatCLP(preset.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Items List */}
              {items.length > 0 ? (
                <div className="divide-y divide-slate-800 border border-slate-800/80 rounded-xl overflow-hidden text-xs">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-900/50 flex items-center justify-between gap-3 hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{item.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                            {item.category}
                          </span>
                        </div>
                        {item.notes && <p className="text-[11px] text-amber-300/80 mt-0.5">Nota: {item.notes}</p>}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">x{item.quantity}</span>
                        <span className="font-bold text-white w-24 text-right">
                          {formatCLP(item.unitPrice * item.quantity)}
                        </span>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Total calculation */}
                  <div className="p-3.5 bg-slate-950 flex items-center justify-between font-bold text-sm text-white">
                    <span>Total del Pedido:</span>
                    <span className="text-emerald-400 text-base">{formatCLP(calculateTotal(items))}</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-slate-900/40 text-center text-xs text-slate-400">
                  No hay ítems registrados en el pedido. Usa "Agregar Plato" para incluir consumo.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>

          <button
            onClick={() => {
              handleStatusChange(currentStatus);
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
          >
            <Check className="h-4 w-4" /> Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
