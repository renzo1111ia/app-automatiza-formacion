"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Search,
  RefreshCw,
  MessageSquare,
  Phone,
  Bot,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Eye,
  Database,
  Zap,
  ArrowRight,
  Server,
  X,
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
      .select(
        `
                *,
                lead:lead_id (nombre, apellido, telefono)
            `
      )
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

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.lead?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.lead?.telefono?.includes(searchTerm) ||
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase());

    if (filter === "ALL") return matchesSearch;
    return matchesSearch && log.result === filter;
  });

  return (
    <div className="bg-background text-foreground min-h-screen space-y-8 p-8 pb-24 transition-colors duration-500">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <div className="text-primary flex items-center gap-3">
            <div className="bg-primary/10 border-primary/20 rounded-xl border p-2">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-xs font-black tracking-[0.2em] uppercase">Auditoría de IA</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            Logs de <span className="text-primary">Ejecución</span>
          </h1>
          <p className="text-muted-foreground max-w-md text-sm font-medium">
            Monitoriza en tiempo real cada mensaje de WhatsApp y llamada generada por el
            orquestador.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            className="bg-card/40 border-border hover:bg-card/60 text-foreground flex h-12 items-center gap-2 rounded-2xl border px-4 text-xs font-bold transition-all"
          >
            <RefreshCw className={cn("text-primary h-4 w-4", loading && "animate-spin")} />
            Actualizar
          </button>
          <div className="bg-card/40 border-border flex h-12 rounded-2xl border p-1">
            {(["ALL", "SUCCESS", "FAILED"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-xl px-4 text-[10px] font-black tracking-widest uppercase transition-all",
                  filter === f
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "ALL" ? "Todos" : f === "SUCCESS" ? "Éxito" : "Errores"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* ── Main List ────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-7">
          <div className="group relative">
            <Search className="text-muted-foreground/20 group-focus-within:text-primary absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 transition-colors" />
            <input
              type="text"
              placeholder="Buscar por nombre de lead o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-card/40 border-border focus:ring-primary/20 text-foreground h-14 w-full rounded-2xl border pr-4 pl-12 text-sm font-medium transition-all focus:ring-2 focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            {loading && logs.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card/40 border-border h-20 animate-pulse rounded-2xl border"
                />
              ))
            ) : filteredLogs.length === 0 ? (
              <div className="border-border bg-card/20 space-y-4 rounded-3xl border border-dashed p-20 text-center">
                <div className="bg-card/40 mx-auto w-fit rounded-full p-4">
                  <Database className="text-muted-foreground/20 h-8 w-8" />
                </div>
                <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                  No hay logs que coincidan
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <motion.div
                  layoutId={log.id}
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-all",
                    selectedLog?.id === log.id
                      ? "bg-primary/10 border-primary/40 shadow-primary/5 shadow-xl"
                      : "bg-card/40 border-border hover:border-foreground/20 hover:bg-card/60"
                  )}
                >
                  {/* Action Icon */}
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl border shadow-inner",
                      log.action_type === "WHATSAPP"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                        : log.action_type === "CALL"
                          ? "border-blue-500/20 bg-blue-500/10 text-blue-500"
                          : "border-purple-500/20 bg-purple-500/10 text-purple-500"
                    )}
                  >
                    {log.action_type === "WHATSAPP" ? (
                      <MessageSquare className="h-5 w-5" />
                    ) : log.action_type === "CALL" ? (
                      <Phone className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-black">
                        {log.lead?.nombre || "Lead Desconocido"} {log.lead?.apellido || ""}
                      </span>
                      {log.ab_variant && (
                        <span className="bg-card/60 text-muted-foreground/60 border-border rounded border px-1.5 py-0.5 text-[8px] font-black uppercase">
                          Var {log.ab_variant}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-3 text-[10px] font-bold tracking-wider uppercase">
                      <span>{log.action_type}</span>
                      <span className="bg-border h-1 w-1 rounded-full" />
                      <span>Paso {log.step_number}</span>
                      <span className="bg-border h-1 w-1 rounded-full" />
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />{" "}
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Result */}
                  <div className="flex flex-col items-end gap-1">
                    {log.result === "SUCCESS" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : log.result === "FAILED" ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Zap className="h-5 w-5 text-amber-500" />
                    )}
                    <span
                      className={cn(
                        "text-[8px] font-black tracking-tighter uppercase",
                        log.result === "SUCCESS" ? "text-emerald-500/50" : "text-red-500/50"
                      )}
                    >
                      {log.result}
                    </span>
                  </div>

                  <ChevronRight className="text-muted-foreground/20 group-hover:text-foreground h-4 w-4 transition-colors" />
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* ── Inspector ────────────────────────────────────────── */}
        <div className="sticky top-8 h-fit lg:col-span-5">
          <AnimatePresence mode="wait">
            {selectedLog ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-card border-border overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl"
              >
                <div className="border-border bg-card/20 border-b p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/20 text-primary border-primary/20 flex h-10 w-10 items-center justify-center rounded-xl border">
                        <Eye className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black tracking-widest uppercase">
                          Inspector de Datos
                        </h3>
                        <p className="text-muted-foreground text-[10px] font-bold">
                          Detalle técnico del envío
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedLog(null)}
                      className="hover:bg-card/60 text-muted-foreground rounded-xl p-2 transition-colors"
                      title="Cerrar inspector"
                      aria-label="Cerrar inspector"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card/40 border-border rounded-2xl border p-3">
                      <p className="text-muted-foreground/40 mb-1 text-[8px] font-black uppercase">
                        Teléfono Lead
                      </p>
                      <p className="text-primary font-mono text-xs">
                        {selectedLog.lead?.telefono || "N/A"}
                      </p>
                    </div>
                    <div className="bg-card/40 border-border rounded-2xl border p-3">
                      <p className="text-muted-foreground/40 mb-1 text-[8px] font-black uppercase">
                        ID Único
                      </p>
                      <p className="text-muted-foreground/60 truncate font-mono text-[9px]">
                        {selectedLog.id}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 p-6">
                  {/* Error Message if any */}
                  {selectedLog.error_message && (
                    <div className="flex gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-black tracking-widest text-red-500 uppercase">
                          Error de Ejecución
                        </p>
                        <p className="text-xs leading-relaxed text-red-200/70 italic">
                          {selectedLog.error_message}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Main Payload Explorer */}
                  <div className="space-y-3">
                    <div className="text-muted-foreground/40 flex items-center gap-2">
                      <Server className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-black tracking-widest uppercase">
                        Metadata / Payload
                      </span>
                    </div>

                    <div className="bg-card/60 border-border custom-scrollbar max-h-[400px] overflow-auto rounded-2xl border p-4 font-mono text-[10px]">
                      <pre className="text-blue-600 dark:text-blue-400">
                        {JSON.stringify(selectedLog.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="border-border flex items-center justify-between border-t pt-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground/40 text-[9px] font-black uppercase">
                        Registro Sincronizado
                      </span>
                    </div>
                    <button className="bg-card/40 text-muted-foreground hover:text-foreground border-border flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-colors">
                      Copiar JSON <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="border-border flex h-[500px] flex-col items-center justify-center space-y-4 rounded-3xl border border-dashed p-12 text-center">
                <div className="bg-card/40 border-border flex h-16 w-16 items-center justify-center rounded-3xl border">
                  <Database className="text-muted-foreground/20 h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-muted-foreground/60 text-sm font-black tracking-widest uppercase">
                    No hay selección
                  </h4>
                  <p className="text-muted-foreground/40 text-xs font-medium">
                    Selecciona un evento de la lista para inspeccionar los datos enviados.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
