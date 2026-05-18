"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, ShieldCheck, RefreshCw, Volume2 } from "lucide-react";
import { syncRetellResources } from "@/lib/actions/retell-sync";
import { syncUltravoxResources } from "@/lib/actions/ultravox-sync";
import { updateTenantConfig } from "@/lib/actions/tenant";
import { cn } from "@/lib/utils";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentRetellKey: string;
    currentUltravoxKey: string;
    tenantId: string;
    onSuccess: (provider: 'retell' | 'ultravox', newKey: string) => void;
}

export function VoiceConfigModal({ isOpen, onClose, currentRetellKey, currentUltravoxKey, tenantId, onSuccess }: Props) {
    const [retellKey, setRetellKey] = useState(currentRetellKey);
    const [ultravoxKey, setUltravoxKey] = useState(currentUltravoxKey);
    const [isSaving, setIsSaving] = useState(false);
    
    const [isTestingRetell, setIsTestingRetell] = useState(false);
    const [retellTestResult, setRetellTestResult] = useState<{ success: boolean; message: string } | null>(null);
    
    const [isTestingUltravox, setIsTestingUltravox] = useState(false);
    const [ultravoxTestResult, setUltravoxTestResult] = useState<{ success: boolean; message: string } | null>(null);

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
            alert("Error: No se encontró el ID del cliente activo.");
            return;
        }
        setIsSaving(true);
        try {
            const res = await updateTenantConfig(tenantId, {
                retell: { api_key: retellKey.trim() },
                ultravox: { api_key: ultravoxKey.trim() }
            });

            if (res.success) {
                if (retellKey !== currentRetellKey) onSuccess('retell', retellKey.trim());
                if (ultravoxKey !== currentUltravoxKey) onSuccess('ultravox', ultravoxKey.trim());
                onClose();
            } else {
                alert("Error al guardar: " + res.error);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error desconocido";
            alert("Error crítico: " + message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 text-left">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        onClick={onClose}
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[40px] p-10 shadow-2xl space-y-8 overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <Volume2 className="h-40 w-40 text-purple-500" />
                        </div>

                        <div className="space-y-4 relative">
                            <div className="h-14 w-14 bg-purple-500/10 rounded-3xl border border-purple-500/20 flex items-center justify-center">
                                <Zap className="h-8 w-8 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight text-white">Configuración de Voz</h3>
                                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Conecta tus proveedores de IA para llamadas automáticas.</p>
                            </div>
                        </div>

                        <div className="space-y-8 relative">
                            {/* Retell Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Retell AI API Key</label>
                                    {retellTestResult && (
                                        <span className={cn("text-[10px] font-bold", retellTestResult.success ? "text-emerald-400" : "text-red-400")}>
                                            {retellTestResult.success ? "● Online" : "● Error"}
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <input 
                                        type="password"
                                        value={retellKey}
                                        onChange={(e) => setRetellKey(e.target.value)}
                                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-sm font-mono focus:border-purple-500/40 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all text-white"
                                        placeholder="key_........"
                                    />
                                    {retellKey && (
                                        <button 
                                            onClick={handleTestRetell}
                                            disabled={isTestingRetell}
                                            className="absolute right-3 top-3 h-8 px-4 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                                        >
                                            {isTestingRetell ? <RefreshCw className="h-3 w-3 animate-spin"/> : <ShieldCheck className="h-3 w-3 text-emerald-400" />}
                                            Test
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Ultravox Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Ultravox API Key</label>
                                    {ultravoxTestResult && (
                                        <span className={cn("text-[10px] font-bold", ultravoxTestResult.success ? "text-emerald-400" : "text-red-400")}>
                                            {ultravoxTestResult.success ? "● Online" : "● Error"}
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <input 
                                        type="password"
                                        value={ultravoxKey}
                                        onChange={(e) => setUltravoxKey(e.target.value)}
                                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-sm font-mono focus:border-purple-500/40 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all text-white"
                                        placeholder="uv_........"
                                    />
                                    {ultravoxKey && (
                                        <button 
                                            onClick={handleTestUltravox}
                                            disabled={isTestingUltravox}
                                            className="absolute right-3 top-3 h-8 px-4 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                                        >
                                            {isTestingUltravox ? <RefreshCw className="h-3 w-3 animate-spin"/> : <ShieldCheck className="h-3 w-3 text-emerald-400" />}
                                            Test
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4 relative">
                            <button 
                                onClick={onClose}
                                className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-[2] h-14 rounded-2xl bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {isSaving ? "Guardando..." : "Guardar Cambios"}
                            </button>
                        </div>

                        <button 
                            onClick={onClose}
                            title="Cerrar modal de configuración"
                            className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}



