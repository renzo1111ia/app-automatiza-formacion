"use client";

import { useState } from "react";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  ArrowRight,
  Play,
  Sparkles,
  MessageSquareQuote,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenantStore } from "@/store/tenant";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * MANUAL CALL LAUNCHER (v2.0)
 * Premium interface for outbound AI calling via Retell SDK logic.
 */

export default function CallsPage() {
  const tenantName = useTenantStore((s) => s.tenantName) || "ESDEN";
  const [phoneNumber, setPhoneNumber] = useState("");

  const [isCalling, setIsCalling] = useState(false);

  const dialPad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0", "#"];

  const handleCall = async () => {
    setIsCalling(true);
    // Simulate API call to /api/calls/manual
    setTimeout(() => setIsCalling(false), 5000); // Simulate end
  };

  return (
    <div className="animate-in fade-in flex flex-col gap-8 p-8 duration-700">
      {/* Header Area */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3 text-left text-3xl font-extrabold tracking-tight">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <PhoneCall className="h-6 w-6" />
            </div>
            Llamadas Proactivas{" "}
            <span className="text-muted-foreground ml-2 text-xs font-black tracking-widest uppercase">
              RETELL AI SDK
            </span>
          </h1>
          <p className="text-muted-foreground text-left text-lg">
            Lanza llamadas manuales de calificación al instante.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-[11px] font-bold text-orange-600 shadow-sm">
            QUALIFY_AGENT_V2: READY
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Dialer Interface */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="bg-card group relative overflow-hidden rounded-[40px] border p-8 shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent" />

            {/* Number Display */}
            <div className="text-primary border-muted mb-8 flex h-20 items-center justify-center border-b px-4 text-4xl font-black tracking-widest tabular-nums">
              {phoneNumber || <span className="opacity-20">INGRESAR NÚMERO</span>}
            </div>

            {/* DialPad Grid */}
            <div className="grid grid-cols-3 gap-4">
              {dialPad.map((num) => (
                <button
                  key={num}
                  onClick={() => setPhoneNumber((prev) => prev + num)}
                  className="bg-secondary/50 hover:bg-primary hover:text-primary-foreground group/btn flex h-20 flex-col items-center justify-center gap-1 rounded-3xl transition-all"
                >
                  <span className="text-2xl font-bold">{num}</span>
                  <span className="text-[9px] font-black opacity-40 group-hover/btn:opacity-100">
                    XYZ
                  </span>
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex items-center gap-4">
              <button
                onClick={() => setPhoneNumber("")}
                title="Borrar número"
                className="border-muted flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors hover:bg-rose-500 hover:text-white"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <button
                onClick={handleCall}
                disabled={phoneNumber.length < 8 || isCalling}
                className={cn(
                  "flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl text-lg font-black shadow-xl transition-all",
                  isCalling
                    ? "animate-pulse bg-amber-500 text-white"
                    : "bg-emerald-500 text-white shadow-emerald-500/20 hover:scale-105"
                )}
              >
                {isCalling ? (
                  <Mic className="h-5 w-5 animate-bounce" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
                {isCalling ? "EN LLAMADA..." : "LLAMAR AHORA"}
              </button>
            </div>
          </div>

          <div className="bg-card/40 space-y-3 rounded-3xl border border-dashed p-6">
            <div className="text-muted-foreground flex items-center justify-start gap-2 text-xs font-black tracking-widest uppercase">
              <ShieldAlert className="h-4 w-4" />
              Pre-Call Checklist
            </div>
            <ul className="space-y-2 text-left text-sm opacity-60">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Horario Legal de Contacto Confirmado
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Saldo de Créditos Retell OK
              </li>
            </ul>
          </div>
        </div>

        {/* Right: Live Monitor / Logs */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className="relative flex min-h-[500px] flex-1 flex-col overflow-hidden rounded-[40px] border bg-slate-950 p-8 text-left text-slate-400 shadow-2xl">
            {/* Monitor Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <h3 className="text-xl font-bold tracking-tight text-white">
                  Live Transcription{" "}
                  <span className="ml-2 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-500">
                    MONITOR_01
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isCalling ? "animate-pulse bg-emerald-500" : "bg-red-500"
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-bold uppercase",
                    isCalling ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {isCalling ? "Streaming" : "Standby"}
                </span>
              </div>
            </div>

            {/* Chat / Transcription Flow */}
            <div
              className={cn(
                "flex-1 space-y-6 overflow-y-auto py-8 transition-opacity duration-500",
                !isCalling && "opacity-20"
              )}
            >
              {isCalling ? (
                <>
                  <div className="flex max-w-[80%] flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                      IA (Qualify Bot) <span className="opacity-40">12:35pm</span>
                    </div>
                    <div className="rounded-2xl rounded-tl-none border border-white/5 bg-slate-900 p-4 text-sm leading-relaxed text-slate-300">
                      &quot;Hola, soy el asistente de {tenantName}. ¿Hablo con el responsable de
                      admisiones?&quot;
                    </div>
                  </div>
                  <div className="flex max-w-[80%] flex-col gap-2 self-end">
                    <div className="flex items-center justify-end gap-2 text-[10px] font-black text-blue-500 uppercase">
                      <span className="opacity-40">12:35pm</span> Lead (Prospero)
                    </div>
                    <div className="rounded-2xl rounded-tr-none border border-blue-500/20 bg-blue-500/10 p-4 text-sm leading-relaxed text-blue-400/90">
                      &quot;Sí, con él habla. ¿De qué se trata?&quot;
                    </div>
                  </div>
                  <div className="flex max-w-[80%] animate-pulse flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                      IA (Qualify Bot) <span className="opacity-40">Writing...</span>
                    </div>
                    <div className="h-6 w-32 rounded-full bg-white/5" />
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <MessageSquareQuote className="h-16 w-16 opacity-10" />
                  <p className="font-medium text-slate-600 italic">
                    Inicia una llamada para ver la <br /> transcripción en tiempo real.
                  </p>
                </div>
              )}
            </div>

            {/* Recent Calls History */}
            <div className="border-t border-white/10 pt-6">
              <h4 className="mb-4 text-xs font-black tracking-widest uppercase">
                Llamadas Recientes
              </h4>
              <EmptyState
                size="sm"
                icon={<PhoneCall className="h-8 w-8" />}
                title="Sin llamadas registradas"
                description="Cuando una campaña de voz arranque o un lead reciba una llamada, aparecerá aquí."
                className="border-white/10 bg-white/[0.02] text-white/60"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
