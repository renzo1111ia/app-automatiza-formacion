"use client";

import React, { useState } from "react";
import { Table, Reservation, ReservationSource } from "@/types/pedidos";
import { X, Sparkles, MessageSquare, PhoneCall, Bot, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SimulationModalProps {
  tables: Table[];
  onClose: () => void;
  onSimulate: (newReservation: Reservation, targetTableId: string) => void;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({
  tables,
  onClose,
  onSimulate,
}) => {
  const [channel, setChannel] = useState<ReservationSource>("whatsapp");
  const [name, setName] = useState("Laura Giménez");
  const [phone, setPhone] = useState("+34 699 887 766");
  const [guests, setGuests] = useState(4);
  const [selectedTableId, setSelectedTableId] = useState(
    tables.find((t) => t.status === "disponible")?.id || tables[0]?.id || ""
  );
  const [specialRequest, setSpecialRequest] = useState("Mesa cerca de la ventana, alérgeno a los frutos secos.");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const targetTable = tables.find((t) => t.id === selectedTableId);
    const tableNumber = targetTable?.number || 1;

    const simulatedRes: Reservation = {
      id: `res-${Date.now()}`,
      tableId: selectedTableId,
      tableNumber,
      customer: {
        name,
        phone,
        isVip: false,
      },
      dateTime: "Hoy, 21:15",
      guestsCount: guests,
      status: "reservada",
      orderStatus: "pendiente",
      createdVia: channel,
      iaSummary: {
        channel,
        timestamp: "Ahora mismo (Simulado)",
        aiAgentName: channel === "whatsapp" ? "Sofía (Agente WA AI)" : "Mateo (Agente Voz AI)",
        confidenceScore: 0.97,
        guestsCount: guests,
        summary: `Reserva realizada automáticamente vía ${
          channel === "whatsapp" ? "WhatsApp AI" : "Llamada de Voz AI"
        } para ${name}. ${specialRequest}`,
        specialRequests: specialRequest,
        keyTopics: ["Reserva IA Simulación", "Reserva Inmediata"],
      },
      items: [
        {
          id: `item-sim-1`,
          name: "Menú Especial Sugerido por IA",
          category: "principal",
          quantity: guests,
          unitPrice: 22500,
        },
      ],
      totalAmount: guests * 22500,
    };

    onSimulate(simulatedRes, selectedTableId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Simulador de Reserva con IA</h3>
              <p className="text-xs text-slate-400">Genera una interacción automatizada en tiempo real</p>
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
          {/* Channel Selector */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1.5">Canal de la IA:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                className={cn(
                  "p-3 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all",
                  channel === "whatsapp"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                    : "bg-slate-800/40 text-slate-400 border-slate-700"
                )}
              >
                <MessageSquare className="h-4 w-4" /> WhatsApp AI
              </button>
              <button
                type="button"
                onClick={() => setChannel("voice")}
                className={cn(
                  "p-3 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all",
                  channel === "voice"
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                    : "bg-slate-800/40 text-slate-400 border-slate-700"
                )}
              >
                <PhoneCall className="h-4 w-4" /> Agente de Voz AI
              </button>
            </div>
          </div>

          {/* Name & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Nombre Cliente:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Teléfono:</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Table assignment & Guests */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Asignar Mesa:</label>
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.status === "disponible" ? "Libre" : t.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Comensales:</label>
              <input
                type="number"
                min={1}
                max={12}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Special request / AI dialog note */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Petición / Nota conversada con la IA:
            </label>
            <textarea
              rows={2}
              value={specialRequest}
              onChange={(e) => setSpecialRequest(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex justify-end gap-2">
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
              <Sparkles className="h-4 w-4" /> Simular y Asignar Mesa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
