"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, ShieldCheck, RefreshCw, Volume2 } from "lucide-react";
import { syncRetellResources } from "@/lib/actions/retell-sync";
import { syncUltravoxResources } from "@/lib/actions/ultravox-sync";
import { updateTenantConfig } from "@/lib/actions/tenant";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentRetellKey: string;
  currentUltravoxKey: string;
  tenantId: string;
  onSuccess: (provider: "retell" | "ultravox", newKey: string) => void;
}

export function VoiceConfigModal({
  isOpen,
  onClose,
  currentRetellKey,
  currentUltravoxKey,
  tenantId,
  onSuccess,
}: Props) {
  const [retellKey, setRetellKey] = useState(currentRetellKey);
  const [ultravoxKey, setUltravoxKey] = useState(currentUltravoxKey);
  const [isSaving, setIsSaving] = useState(false);

  const [isTestingRetell, setIsTestingRetell] = useState(false);
  const [retellTestResult, setRetellTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [isTestingUltravox, setIsTestingUltravox] = useState(false);
  const [ultravoxTestResult, setUltravoxTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleTestRetell = async () => {
    if (!retellKey) return;
    setIsTestingRetell(true);
    setRetellTestResult(null);
    try {
      const res = await syncRetellResources(retellKey);
      if (res.success) {
        setRetellTestResult({ success: true, message: "Conexión con Retell exitosa." });
      } else {
        setRetellTestResult({ success: false, message: res.error || "Error en Retell." });
      }
    } catch {
      setRetellTestResult({ success: false, message: "Fallo al conectar con Retell." });
    } finally {
      setIsTestingRetell(false);
    }
  };

  const handleTestUltravox = async () => {
    if (!ultravoxKey) return;
    setIsTestingUltravox(true);
    setUltravoxTestResult(null);
    try {
      const res = await syncUltravoxResources(ultravoxKey);
      if (res.success) {
        setUltravoxTestResult({ success: true, message: "Conexión con Ultravox exitosa." });
      } else {
        setUltravoxTestResult({ success: false, message: res.error || "Error en Ultravox." });
      }
    } catch {
      setUltravoxTestResult({ success: false, message: "Fallo al conectar con Ultravox." });
    } finally {
      setIsTestingUltravox(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) {
      toast({
        variant: "error",
        title: "ID de cliente no encontrado",
        description: "No se encontró el ID del cliente activo.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const res = await updateTenantConfig(tenantId, {
        retell: { api_key: retellKey.trim() },
        ultravox: { api_key: ultravoxKey.trim() },
      });

      if (res.success) {
        if (retellKey !== currentRetellKey) onSuccess("retell", retellKey.trim());
        if (ultravoxKey !== currentUltravoxKey) onSuccess("ultravox", ultravoxKey.trim());
        onClose();
      } else {
        toast({ variant: "error", title: "Error al guardar", description: res.error });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast({ variant: "error", title: "Error crítico", description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 text-left">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-xl space-y-8 overflow-hidden rounded-[40px] border border-white/10 bg-slate-900 p-10 shadow-2xl"
          >
            <div className="pointer-events-none absolute top-0 right-0 p-8 opacity-10">
              <Volume2 className="h-40 w-40 text-purple-500" />
            </div>

            <div className="relative space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-purple-500/20 bg-purple-500/10">
                <Zap className="h-8 w-8 text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-white uppercase">
                  Configuración de Voz
                </h3>
                <p className="mt-1 text-xs font-bold tracking-widest text-white/40 uppercase">
                  Conecta tus proveedores de IA para llamadas automáticas.
                </p>
              </div>
            </div>

            <div className="relative space-y-8">
              {/* Retell Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black tracking-widest text-white/40 uppercase">
                    Retell AI API Key
                  </label>
                  {retellTestResult && (
                    <span
                      className={cn(
                        "text-[10px] font-bold",
                        retellTestResult.success ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {retellTestResult.success ? "● Online" : "● Error"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={retellKey}
                    onChange={(e) => setRetellKey(e.target.value)}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-6 font-mono text-sm text-white transition-all outline-none focus:border-purple-500/40 focus:ring-4 focus:ring-purple-500/10"
                    placeholder="key_........"
                  />
                  {retellKey && (
                    <button
                      onClick={handleTestRetell}
                      disabled={isTestingRetell}
                      className="absolute top-3 right-3 flex h-8 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-[9px] font-black tracking-widest uppercase transition-all hover:bg-white/10"
                    >
                      {isTestingRetell ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      )}
                      Test
                    </button>
                  )}
                </div>
              </div>

              {/* Ultravox Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black tracking-widest text-white/40 uppercase">
                    Ultravox API Key
                  </label>
                  {ultravoxTestResult && (
                    <span
                      className={cn(
                        "text-[10px] font-bold",
                        ultravoxTestResult.success ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {ultravoxTestResult.success ? "● Online" : "● Error"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={ultravoxKey}
                    onChange={(e) => setUltravoxKey(e.target.value)}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-6 font-mono text-sm text-white transition-all outline-none focus:border-purple-500/40 focus:ring-4 focus:ring-purple-500/10"
                    placeholder="uv_........"
                  />
                  {ultravoxKey && (
                    <button
                      onClick={handleTestUltravox}
                      disabled={isTestingUltravox}
                      className="absolute top-3 right-3 flex h-8 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-[9px] font-black tracking-widest uppercase transition-all hover:bg-white/10"
                    >
                      {isTestingUltravox ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      )}
                      Test
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="relative flex gap-4 pt-4">
              <button
                onClick={onClose}
                className="h-14 flex-1 rounded-2xl border border-white/10 bg-white/5 text-[10px] font-black tracking-widest text-white uppercase transition-all hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="h-14 flex-[2] rounded-2xl bg-purple-600 text-[10px] font-black tracking-widest text-white uppercase shadow-xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>

            <button
              onClick={onClose}
              title="Cerrar modal de configuración"
              className="absolute top-6 right-6 text-white/20 transition-colors hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
