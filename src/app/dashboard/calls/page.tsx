"use client";

import { useState } from "react";
import { 
    PhoneCall, PhoneOff, Mic, 
    ArrowRight, Play,
    Sparkles, MessageSquareQuote, CheckCircle2,
    ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenantStore } from "@/store/tenant";


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
        <div className="flex flex-col gap-8 p-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 text-left">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                            <PhoneCall className="h-6 w-6" />
                        </div>
                        Llamadas Proactivas <span className="text-xs text-muted-foreground ml-2 uppercase tracking-widest font-black">RETELL AI SDK</span>
                    </h1>
                    <p className="text-muted-foreground text-lg text-left">
                        Lanza llamadas manuales de calificación al instante.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                     <div className="px-4 py-2 rounded-xl bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[11px] font-bold shadow-sm">
                        QUALIFY_AGENT_V2: READY
                     </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Dialer Interface */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="p-8 rounded-[40px] bg-card border shadow-2xl backdrop-blur-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                        
                        {/* Number Display */}
                        <div className="h-20 flex items-center justify-center text-4xl font-black tracking-widest tabular-nums text-primary mb-8 px-4 border-b border-muted">
                            {phoneNumber || <span className="opacity-20">INGRESAR NÚMERO</span>}
                        </div>

                        {/* DialPad Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            {dialPad.map((num) => (
                                <button 
                                    key={num} 
                                    onClick={() => setPhoneNumber(prev => prev + num)}
                                    className="h-20 rounded-3xl bg-secondary/50 hover:bg-primary hover:text-primary-foreground transition-all flex flex-col items-center justify-center gap-1 group/btn"
                                >
                                    <span className="text-2xl font-bold">{num}</span>
                                    <span className="text-[9px] font-black opacity-40 group-hover/btn:opacity-100">XYZ</span>
                                </button>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-8 flex items-center gap-4">
                            <button 
                                onClick={() => setPhoneNumber("")}
                                title="Borrar número"
                                className="h-14 w-14 rounded-2xl flex items-center justify-center border border-muted hover:bg-rose-500 hover:text-white transition-colors"
                            >
                                <PhoneOff className="h-6 w-6" />
                            </button>
                            <button 
                                onClick={handleCall}
                                disabled={phoneNumber.length < 8 || isCalling}
                                className={cn(
                                    "flex-1 h-14 rounded-2xl flex items-center justify-center gap-3 font-black text-lg transition-all shadow-xl",
                                    isCalling ? "bg-amber-500 text-white animate-pulse" : "bg-emerald-500 text-white shadow-emerald-500/20 hover:scale-105"
                                )}
                            >
                                {isCalling ? <Mic className="h-5 w-5 animate-bounce" /> : <Play className="h-5 w-5" />}
                                {isCalling ? "EN LLAMADA..." : "LLAMAR AHORA"}
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-6 rounded-3xl border bg-card/40 border-dashed space-y-3">
                        <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest justify-start">
                            <ShieldAlert className="h-4 w-4" />
                            Pre-Call Checklist
                        </div>
                        <ul className="space-y-2 text-sm opacity-60 text-left">
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
                <div className="lg:col-span-7 flex flex-col gap-6">
                    <div className="flex-1 min-h-[500px] p-8 rounded-[40px] border bg-slate-950 text-slate-400 shadow-2xl relative flex flex-col overflow-hidden text-left">
                        {/* Monitor Header */}
                        <div className="flex items-center justify-between pb-6 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <Sparkles className="h-5 w-5 text-indigo-400" />
                                <h3 className="text-xl font-bold text-white tracking-tight">Live Transcription <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-500 ml-2">MONITOR_01</span></h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={cn("h-2 w-2 rounded-full", isCalling ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                                <span className={cn("text-xs font-bold uppercase", isCalling ? "text-emerald-500" : "text-red-500")}>
                                    {isCalling ? "Streaming" : "Standby"}
                                </span>
                            </div>
                        </div>

                        {/* Chat / Transcription Flow */}
                        <div className={cn("flex-1 overflow-y-auto py-8 space-y-6 transition-opacity duration-500", !isCalling && "opacity-20")}>
                            {isCalling ? (
                                <>
                                    <div className="flex flex-col gap-2 max-w-[80%]">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                                            IA (Qualify Bot) <span className="opacity-40">12:35pm</span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 text-sm text-slate-300 leading-relaxed rounded-tl-none">
                                            &quot;Hola, soy el asistente de {tenantName}. ¿Hablo con el responsable de admisiones?&quot;
                                        </div>

                                    </div>
                                    <div className="flex flex-col gap-2 max-w-[80%] self-end">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-500 justify-end">
                                            <span className="opacity-40">12:35pm</span> Lead (Prospero)
                                        </div>
                                        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400/90 leading-relaxed rounded-tr-none">
                                            &quot;Sí, con él habla. ¿De qué se trata?&quot;
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 max-w-[80%] animate-pulse">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                                            IA (Qualify Bot) <span className="opacity-40">Writing...</span>
                                        </div>
                                        <div className="h-6 w-32 bg-white/5 rounded-full" />
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex items-center justify-center flex-col gap-4 text-center">
                                    <MessageSquareQuote className="h-16 w-16 opacity-10" />
                                    <p className="text-slate-600 font-medium italic">Inicia una llamada para ver la <br/> transcripción en tiempo real.</p>
                                </div>
                            )}
                        </div>

                        {/* Recent Calls History */}
                        <div className="pt-6 border-t border-white/10">
                            <h4 className="text-xs font-black uppercase tracking-widest mb-4">Llamadas Recientes</h4>
                            <div className="space-y-3">
                                {[
                                    { phone: "+34 612 345 678", status: "Calificado", time: "10m" },
                                    { phone: "+34 600 000 000", status: "No Cualif.", time: "1h" },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <PhoneCall className="h-4 w-4 opacity-40 group-hover:text-blue-400" />
                                            <span className="text-xs font-mono font-bold text-white/80">{item.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={cn(
                                                "text-[9px] px-2 py-0.5 rounded-full font-black uppercase",
                                                item.status === "Calificado" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                            )}>{item.status}</span>
                                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-40" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
