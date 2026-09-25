"use client";

import { useState, useMemo } from "react";
import {
  Phone,
  Search,
  Filter,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Download,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  PhoneCall,
  User,
  SlidersHorizontal,
} from "lucide-react";
import { UltravoxCallItem, fetchUltravoxLeadCalls } from "@/lib/actions/ultravox-calls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CallDetailDrawer } from "./CallDetailDrawer";

interface LeadCallsTableProps {
  initialCalls: UltravoxCallItem[];
  totalCount: number;
  apiKeyFound: boolean;
  error?: string;
}

export function LeadCallsTable({
  initialCalls,
  totalCount,
  apiKeyFound,
  error: initialError,
}: LeadCallsTableProps) {
  const [calls, setCalls] = useState<UltravoxCallItem[]>(initialCalls);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<UltravoxCallItem | null>(null);
  const [error, setError] = useState<string | undefined>(initialError);

  const handleRefresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/lead-calls?limit=100");
      const data = await res.json();
      if (data?.success) {
        setCalls(data.calls || []);
      } else {
        setError(data?.error || "Error al actualizar");
      }
    } catch (e: any) {
      setError(e?.message || "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      // Status filter
      if (statusFilter === "completed" && c.status !== "completed" && !c.ended) return false;
      if (statusFilter === "with_vars" && Object.keys(c.variables || {}).length === 0) return false;

      // Search query
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchPhone = c.callerId?.toLowerCase().includes(q) || c.dialedNumber?.toLowerCase().includes(q);
      const matchAgent = c.agentName?.toLowerCase().includes(q);
      const matchSummary = c.summary?.toLowerCase().includes(q) || c.shortSummary?.toLowerCase().includes(q);
      const matchId = c.callId?.toLowerCase().includes(q);
      const matchVars = Object.entries(c.variables || {}).some(
        ([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
      );

      return matchPhone || matchAgent || matchSummary || matchId || matchVars;
    });
  }, [calls, search, statusFilter]);

  // Statistics calculation
  const totalCalls = calls.length;
  const totalSeconds = calls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
  const avgSeconds = totalCalls > 0 ? Math.round(totalSeconds / totalCalls) : 0;
  const callsWithVariables = calls.filter((c) => Object.keys(c.variables || {}).length > 0).length;
  const completedCalls = calls.filter((c) => c.status === "completed" || c.ended).length;

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}m ${rem.toString().padStart(2, "0")}s`;
  };

  const handleExportCsv = () => {
    if (filteredCalls.length === 0) return;
    const headers = ["ID Llamada", "Fecha", "Agente", "Contacto", "Duracion (seg)", "Estado", "Resumen", "Variables Capturadas"];
    const rows = filteredCalls.map((c) => [
      c.callId,
      new Date(c.created).toLocaleString(),
      `"${c.agentName}"`,
      `"${c.callerId || ""}"`,
      c.durationSeconds,
      c.status,
      `"${(c.shortSummary || "").replace(/"/g, '""')}"`,
      `"${JSON.stringify(c.variables).replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `llamadas_ultravox_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!apiKeyFound) {
    return (
      <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-xl font-bold text-foreground">API Key de Ultravox Requerida</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Para ver las llamadas y variables capturadas de tus agentes de voz, debes ingresar la API Key de Ultravox en la sección de Configuración de Tenant o Agentes de Voz.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Llamadas */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-blue-500/30">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <PhoneCall className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Llamadas
            </p>
            <p className="text-2xl font-black tracking-tight text-foreground">{totalCalls}</p>
          </div>
        </div>

        {/* Card 2: Duración Promedio */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-purple-500/30">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Duración Promedio
            </p>
            <p className="text-2xl font-black tracking-tight text-foreground">
              {formatDuration(avgSeconds)}
            </p>
          </div>
        </div>

        {/* Card 3: Con Variables Capturadas */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-emerald-500/30">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Con Datos de Lead
            </p>
            <p className="text-2xl font-black tracking-tight text-foreground">
              {callsWithVariables}
            </p>
          </div>
        </div>

        {/* Card 4: Tasa de Finalización */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-amber-500/30">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Completadas
            </p>
            <p className="text-2xl font-black tracking-tight text-foreground">
              {completedCalls}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0}%)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por teléfono, agente, resumen o variable (ej: RUT, repuesto, empresa)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-card border-border shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-xs outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los Estados</option>
            <option value="completed">Solo Completadas</option>
            <option value="with_vars">Con Variables Capturadas</option>
          </select>

          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={filteredCalls.length === 0}
            className="h-11 gap-2 rounded-xl border-border bg-card px-4 text-xs font-semibold shadow-xs"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="h-11 gap-2 rounded-xl border-border bg-card px-4 text-xs font-semibold shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-blue-500" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Calls Table Container */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Fecha & Agente</th>
                <th className="px-6 py-4">Contacto</th>
                <th className="px-6 py-4">Duración</th>
                <th className="px-6 py-4">Variables Capturadas</th>
                <th className="px-6 py-4">Resumen de la Llamada</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Phone className="mx-auto h-8 w-8 opacity-40 mb-2" />
                    No se encontraron registros de llamadas que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredCalls.map((call) => {
                  const varEntries = Object.entries(call.variables || {});
                  return (
                    <tr
                      key={call.callId}
                      className="group cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => setSelectedCall(call)}
                    >
                      {/* Fecha y Agente */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {call.agentName}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(call.created).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Contacto */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-mono text-xs font-medium text-foreground">
                            {call.callerId || "Desconocido"}
                          </span>
                        </div>
                      </td>

                      {/* Duración & Estado */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {formatDuration(call.durationSeconds)}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">
                            {call.endReason || call.status}
                          </span>
                        </div>
                      </td>

                      {/* Variables Capturadas Chips */}
                      <td className="px-6 py-4 max-w-xs">
                        {varEntries.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">
                            Sin variables
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {varEntries.slice(0, 3).map(([k, v]) => (
                              <Badge
                                key={k}
                                variant="outline"
                                className="border-blue-500/20 bg-blue-500/5 text-[10px] font-medium text-blue-700 dark:text-blue-300 py-0.5 px-2"
                              >
                                <span className="font-bold uppercase opacity-80">{k}:</span>{" "}
                                <span className="ml-1 truncate max-w-[100px] inline-block align-bottom">
                                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                </span>
                              </Badge>
                            ))}
                            {varEntries.length > 3 && (
                              <Badge variant="secondary" className="text-[10px] py-0.5 px-1.5">
                                +{varEntries.length - 3} más
                              </Badge>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Resumen */}
                      <td className="px-6 py-4 max-w-md">
                        <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                          {call.shortSummary || call.summary || "Llamada sin resumen registrado."}
                        </p>
                      </td>

                      {/* Botón Acción */}
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCall(call)}
                          className="h-8 gap-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
                        >
                          Ver Detalle
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Detail Drawer Modal */}
      <CallDetailDrawer call={selectedCall} onClose={() => setSelectedCall(null)} />
    </div>
  );
}
