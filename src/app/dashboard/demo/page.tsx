"use client";

import { useState } from "react";
import { useTenantStore } from "@/store/tenant";
import { runLaboratoryInjection, clearDemoData } from "@/lib/actions/demo";
import { FlaskConical, CheckCircle2, AlertTriangle, Database, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DemoSimulatorPage() {
  const { tenantId, tenantName, isConfigured } = useTenantStore();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleInject = async () => {
    if (!tenantId) {
      setStatus("error");
      setMessage("No hay ningún cliente seleccionado.");
      return;
    }

    if (!confirm(`¿Estás seguro de inyectar datos de prueba en el cliente "${tenantName}"?`)) {
      return;
    }

    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const res = await runLaboratoryInjection(tenantId);
      if (res.error) {
        setStatus("error");
        setMessage(res.error);
      } else {
        setStatus("success");
        setMessage(res.message || "Datos inyectados correctamente.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!tenantId) {
      setStatus("error");
      setMessage("No hay ningún cliente seleccionado.");
      return;
    }

    if (
      !confirm(
        `¿Estás seguro de ELIMINAR TODOS los datos de prueba del cliente "${tenantName}"? Esto no afectará a los datos reales.`
      )
    ) {
      return;
    }

    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const res = await clearDemoData(tenantId);
      if (res.error) {
        setStatus("error");
        setMessage(res.error);
      } else {
        setStatus("success");
        setMessage(res.message || "Datos limpiados correctamente.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in mx-auto max-w-4xl space-y-8 pt-6 duration-500">
      <div className="border-sidebar-border flex items-center gap-4 border-b pb-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
          <FlaskConical className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">Laboratorio Demo</h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Inyecta datos de prueba para validar el sistema de {tenantName || "tu cliente"}.
          </p>
        </div>
      </div>

      {!isConfigured ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <h3 className="font-bold text-amber-800">Cliente no configurado</h3>
          <p className="max-w-sm text-sm text-amber-700">
            No puedes inyectar datos todavía. Ve a Configuración y guarda los detalles del cliente
            primero.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="border-sidebar-border bg-card overflow-hidden rounded-2xl border shadow-sm">
            <div className="border-sidebar-border border-b bg-slate-50/50 p-6 dark:bg-slate-900/50">
              <div className="mb-2 flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-500" />
                <h2 className="text-card-foreground text-lg font-bold">
                  Paquete: Generador Omnicanal
                </h2>
              </div>
              <p className="text-muted-foreground text-sm">
                Inyecta un flujo completo de prueba en la base de datos de{" "}
                <strong>{tenantName}</strong>.
              </p>
            </div>
            <div className="space-y-6 p-6">
              <ul className="space-y-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Crea{" "}
                  <span className="font-bold">1</span> Programa / Campaña
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Inserta{" "}
                  <span className="font-bold">5</span> Leads (Prospectos)
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Simula{" "}
                  <span className="font-bold">2</span> Llamadas Telefónicas (Retell AI)
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Simula{" "}
                  <span className="font-bold">2</span> Mensajes de WhatsApp
                </li>
              </ul>

              <button
                onClick={handleInject}
                disabled={loading}
                className={cn(
                  "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-md transition-all",
                  loading
                    ? "cursor-not-allowed bg-slate-400"
                    : "bg-purple-600 hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/30"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Inyectando datos...
                  </>
                ) : (
                  <>
                    <FlaskConical className="h-5 w-5" /> Inyectar Datos de Prueba
                  </>
                )}
              </button>

              {status === "success" && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-800">¡Acción Completada!</h4>
                    <p className="mt-1 text-xs text-emerald-600">{message}</p>
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <h4 className="text-sm font-bold text-red-800">Error en la operación</h4>
                    <p className="mt-1 text-xs text-red-600">{message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-sidebar-border bg-card rounded-2xl border p-6 shadow-sm">
              <h3 className="text-card-foreground mb-2 flex items-center gap-2 text-sm font-bold">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-[10px] font-black text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                  01
                </span>
                Aislamiento Multi-Tenant
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Los datos inyectados heredan el <code>tenant_id</code> de{" "}
                <strong>{tenantName}</strong>. Las políticas RLS garantizan el aislamiento absoluto.
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50/30 p-6 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-900">
                <Trash2 className="h-5 w-5 text-red-600" />
                Gestión de Limpieza
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-red-800/80">
                Elimina únicamente los datos generados por este simulador (leads con origen
                &quot;LAB DEMO&quot;).
              </p>
              <button
                onClick={handleClear}
                disabled={loading}
                className={cn(
                  "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[10px] font-black tracking-widest uppercase shadow-sm transition-all",
                  loading
                    ? "cursor-not-allowed bg-slate-200 text-slate-400"
                    : "border border-red-200 bg-white text-red-600 shadow-red-100 hover:border-red-600 hover:bg-red-600 hover:text-white"
                )}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Limpiar Datos Demo</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
