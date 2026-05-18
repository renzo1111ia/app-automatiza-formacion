"use client";

import React, { useState, useEffect } from "react";
import { 
    Activity, Search, RefreshCw, 
    MessageSquare, Phone, Bot, AlertCircle, 
    CheckCircle2, Clock, ChevronRight, Eye,
    Database, Zap, ArrowRight, Server, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/lib/supabase/client";

interface OrchestrationLog {
    id: string;
    created_at: string;
    action_type: string;
    result: string;
    step_number: number;
    error_message: string | null;
    metadata: Record<string, unknown>;
    lead: {
        nombre: string;
        apellido: string;
        telefono: string;
    };
    agent_used: string | null;
    ab_variant: string | null;
}

export default function LogsPage() {
    const [logs, setLogs] = useState<OrchestrationLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedLog, setSelectedLog] = useState<OrchestrationLog | null>(null);
    const [filter, setFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");

    const fetchLogs = async () => {
        setLoading(true);
        const supabase = getSupabaseClient();
        
        const { data, error } = await supabase
            .from("orchestration_logs")
            .select(`
                *,
                lead:lead_id (nombre, apellido, telefono)
            `)
            .order("created_at", { ascending: false })
            .limit(50);

        if (!error && data) {
            setLogs(data as unknown as OrchestrationLog[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            void fetchLogs();
        }, 0);
        const interval = setInterval(fetchLogs, 10000);
        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, []);

    const filteredLogs = logs.filter(log => {
        const matchesSearch = 
            log.lead?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.lead?.telefono?.includes(searchTerm) ||
            log.action_type.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (filter === "ALL") return matchesSearch;
        return matchesSearch && log.result === filter;
    });

    return (
        <div className="min-h-screen bg-background text-foreground p-8 space-y-8 pb-24 transition-colors duration-500">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-primary">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                            <Activity className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.2em]">Auditoría de IA</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight">Logs de <span className="text-primary">Ejecución</span></h1>
                    <p className="text-muted-foreground text-sm font-medium max-w-md">
                        Monitoriza en tiempo real cada mensaje de WhatsApp y llamada generada por el orquestador.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchLogs}
                        className="h-12 px-4 rounded-2xl bg-card/40 border border-border hover:bg-card/60 transition-all flex items-center gap-2 text-xs font-bold text-foreground"
                    >
                        <RefreshCw className={cn("h-4 w-4 text-primary", loading && "animate-spin")} />
                        Actualizar
                    </button>
                    <div className="h-12 flex bg-card/40 border border-border rounded-2xl p-1">
                        {(["ALL", "SUCCESS", "FAILED"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    filter === f ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {f === "ALL" ? "Todos" : f === "SUCCESS" ? "Éxito" : "Errores"}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* ── Main List ────────────────────────────────────────── */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/20 group-focus-within:text-primary transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre de lead o teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-14 bg-card/40 border border-border rounded-2xl pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-foreground"
                        />
                    </div>

                    <div className="space-y-3">
                        {loading && logs.length === 0 ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-20 bg-card/40 rounded-2xl animate-pulse border border-border" />
                            ))
                        ) : filteredLogs.length === 0 ? (
                            <div className="p-20 text-center space-y-4 rounded-3xl border border-dashed border-border bg-card/20">
                                <div className="p-4 rounded-full bg-card/40 w-fit mx-auto">
                                    <Database className="h-8 w-8 text-muted-foreground/20" />
                                </div>
                                <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No hay logs que coincidan</p>
                            </div>
                        ) : (
                            filteredLogs.map((log) => (
                                <motion.div
                                    layoutId={log.id}
                                    key={log.id}
                                    onClick={() => setSelectedLog(log)}
                                    className={cn(
                                        "group relative p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4",
                                        selectedLog?.id === log.id 
                                            ? "bg-primary/10 border-primary/40 shadow-xl shadow-primary/5" 
                                            : "bg-card/40 border-border hover:border-foreground/20 hover:bg-card/60"
                                    )}
                                >
                                    {/* Action Icon */}
                                    <div className={cn(
                                        "h-12 w-12 rounded-xl flex items-center justify-center border shadow-inner",
                                        log.action_type === 'WHATSAPP' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                        log.action_type === 'CALL' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                                        "bg-purple-500/10 border-purple-500/20 text-purple-500"
                                    )}>
                                        {log.action_type === 'WHATSAPP' ? <MessageSquare className="h-5 w-5" /> :
                                         log.action_type === 'CALL' ? <Phone className="h-5 w-5" /> :
                                         <Bot className="h-5 w-5" />}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-sm truncate">
                                                {log.lead?.nombre || "Lead Desconocido"} {log.lead?.apellido || ""}
                                            </span>
                                            {log.ab_variant && (
                                                <span className="px-1.5 py-0.5 rounded bg-card/60 text-[8px] font-black text-muted-foreground/60 uppercase border border-border">
                                                    Var {log.ab_variant}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                            <span>{log.action_type}</span>
                                            <span className="h-1 w-1 rounded-full bg-border" />
                                            <span>Paso {log.step_number}</span>
                                            <span className="h-1 w-1 rounded-full bg-border" />
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(log.created_at).toLocaleTimeString()}</span>
                                        </div>
                                    </div>

                                    {/* Result */}
                                    <div className="flex flex-col items-end gap-1">
                                        {log.result === 'SUCCESS' ? (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        ) : log.result === 'FAILED' ? (
                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                        ) : (
                                            <Zap className="h-5 w-5 text-amber-500" />
                                        )}
                                        <span className={cn(
                                            "text-[8px] font-black uppercase tracking-tighter",
                                            log.result === 'SUCCESS' ? "text-emerald-500/50" : "text-red-500/50"
                                        )}>
                                            {log.result}
                                        </span>
                                    </div>
                                    
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-foreground transition-colors" />
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* ── Inspector ────────────────────────────────────────── */}
                <div className="lg:col-span-5 h-fit sticky top-8">
                    <AnimatePresence mode="wait">
                        {selectedLog ? (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl"
                            >
                                <div className="p-6 border-b border-border bg-card/20">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                                                <Eye className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black uppercase tracking-widest">Inspector de Datos</h3>
                                                <p className="text-[10px] text-muted-foreground font-bold">Detalle técnico del envío</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedLog(null)}
                                            className="p-2 rounded-xl hover:bg-card/60 text-muted-foreground transition-colors"
                                            title="Cerrar inspector"
                                            aria-label="Cerrar inspector"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-2xl bg-card/40 border border-border">
                                            <p className="text-[8px] font-black text-muted-foreground/40 uppercase mb-1">Teléfono Lead</p>
                                            <p className="text-xs font-mono text-primary">{selectedLog.lead?.telefono || 'N/A'}</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-card/40 border border-border">
                                            <p className="text-[8px] font-black text-muted-foreground/40 uppercase mb-1">ID Único</p>
                                            <p className="text-[9px] font-mono text-muted-foreground/60 truncate">{selectedLog.id}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Error Message if any */}
                                    {selectedLog.error_message && (
                                        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3">
                                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Error de Ejecución</p>
                                                <p className="text-xs text-red-200/70 leading-relaxed italic">{selectedLog.error_message}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Main Payload Explorer */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-muted-foreground/40">
                                            <Server className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Metadata / Payload</span>
                                        </div>
                                        
                                        <div className="bg-card/60 rounded-2xl border border-border p-4 font-mono text-[10px] overflow-auto max-h-[400px] custom-scrollbar">
                                            <pre className="text-blue-600 dark:text-blue-400">
                                                {JSON.stringify(selectedLog.metadata, null, 2)}
                                            </pre>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-border flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[9px] font-black text-muted-foreground/40 uppercase">Registro Sincronizado</span>
                                        </div>
                                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/40 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors border border-border">
                                            Copiar JSON <ArrowRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="h-[500px] rounded-3xl border border-dashed border-border flex flex-col items-center justify-center p-12 text-center space-y-4">
                                <div className="h-16 w-16 rounded-3xl bg-card/40 flex items-center justify-center border border-border">
                                    <Database className="h-8 w-8 text-muted-foreground/20" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">No hay selección</h4>
                                    <p className="text-xs text-muted-foreground/40 font-medium">Selecciona un evento de la lista para inspeccionar los datos enviados.</p>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
