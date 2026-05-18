"use client";

import { useState } from "react";
import { useTenantStore } from "@/store/tenant";
import { runLaboratoryInjection, clearDemoData } from "@/lib/actions/demo";
import { 
    FlaskConical, 
    CheckCircle2, 
    AlertTriangle,
    Database,
    Loader2,
    Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DemoSimulatorPage() {
    const { tenantId, tenantName, isConfigured } = useTenantStore();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleInject = async () => {
        if (!tenantId) {
            setStatus('error');
            setMessage('No hay ningún cliente seleccionado.');
            return;
        }

        if (!confirm(`¿Estás seguro de inyectar datos de prueba en el cliente "${tenantName}"?`)) {
            return;
        }

        setLoading(true);
        setStatus('idle');
        setMessage('');

        try {
            const res = await runLaboratoryInjection(tenantId);
            if (res.error) {
                setStatus('error');
                setMessage(res.error);
            } else {
                setStatus('success');
                setMessage(res.message || "Datos inyectados correctamente.");
            }
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'Error desconocido.');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = async () => {
        if (!tenantId) {
            setStatus('error');
            setMessage('No hay ningún cliente seleccionado.');
            return;
        }

        if (!confirm(`¿Estás seguro de ELIMINAR TODOS los datos de prueba del cliente "${tenantName}"? Esto no afectará a los datos reales.`)) {
            return;
        }

        setLoading(true);
        setStatus('idle');
        setMessage('');

        try {
            const res = await clearDemoData(tenantId);
            if (res.error) {
                setStatus('error');
                setMessage(res.error);
            } else {
                setStatus('success');
                setMessage(res.message || "Datos limpiados correctamente.");
            }
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'Error desconocido.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pt-6">
            <div className="flex items-center gap-4 border-b border-sidebar-border pb-6">
                <div className="h-14 w-14 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <FlaskConical className="h-7 w-7" />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground">Laboratorio Demo</h1>
                    <p className="text-muted-foreground mt-1 font-medium">Inyecta datos de prueba para validar el sistema de {tenantName || 'tu cliente'}.</p>
                </div>
            </div>

            {!isConfigured ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex flex-col items-center justify-center text-center space-y-3">
                    <AlertTriangle className="h-10 w-10 text-amber-500" />
                    <h3 className="font-bold text-amber-800">Cliente no configurado</h3>
                    <p className="text-amber-700 text-sm max-w-sm">No puedes inyectar datos todavía. Ve a Configuración y guarda los detalles del cliente primero.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-sidebar-border bg-card shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-sidebar-border bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-3 mb-2">
                                <Database className="h-5 w-5 text-blue-500" />
                                <h2 className="text-lg font-bold text-card-foreground">Paquete: Generador Omnicanal</h2>
                            </div>
                            <p className="text-sm text-muted-foreground">Inyecta un flujo completo de prueba en la base de datos de <strong>{tenantName}</strong>.</p>
                        </div>
                        <div className="p-6 space-y-6">
                            <ul className="space-y-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Crea <span className="font-bold">1</span> Programa / Campaña</li>
                                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Inserta <span className="font-bold">5</span> Leads (Prospectos)</li>
                                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Simula <span className="font-bold">2</span> Llamadas Telefónicas (Retell AI)</li>
                                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Simula <span className="font-bold">2</span> Mensajes de WhatsApp</li>
                            </ul>

                            <button
                                onClick={handleInject}
                                disabled={loading}
                                className={cn(
                                    "w-full h-12 rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 text-white",
                                    loading ? "bg-slate-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/30"
                                )}
                            >
                                {loading ? (
                                    <><Loader2 className="h-5 w-5 animate-spin" /> Inyectando datos...</>
                                ) : (
                                    <><FlaskConical className="h-5 w-5" /> Inyectar Datos de Prueba</>
                                )}
                            </button>

                            {status === 'success' && (
                                <div className="rounded-xl bg-emerald-50 border border-emerald-200 mt-4 p-4 flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-emerald-800">¡Acción Completada!</h4>
                                        <p className="text-xs text-emerald-600 mt-1">{message}</p>
                                    </div>
                                </div>
                            )}

                            {status === 'error' && (
                                <div className="rounded-xl bg-red-50 border border-red-200 mt-4 p-4 flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-red-800">Error en la operación</h4>
                                        <p className="text-xs text-red-600 mt-1">{message}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-2xl border border-sidebar-border bg-card p-6 shadow-sm">
                            <h3 className="font-bold text-card-foreground mb-2 flex items-center gap-2 text-sm">
                                <span className="h-6 w-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-black">01</span> 
                                Aislamiento Multi-Tenant
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Los datos inyectados heredan el <code>tenant_id</code> de <strong>{tenantName}</strong>. 
                                Las políticas RLS garantizan el aislamiento absoluto.
                            </p>
                        </div>
                        
                        <div className="rounded-2xl border border-red-200 bg-red-50/30 p-6 shadow-sm">
                            <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2 text-sm">
                                <Trash2 className="h-5 w-5 text-red-600" />
                                Gestión de Limpieza
                            </h3>
                            <p className="text-xs text-red-800/80 leading-relaxed mb-4">
                                Elimina únicamente los datos generados por este simulador (leads con origen &quot;LAB DEMO&quot;).
                            </p>
                            <button
                                onClick={handleClear}
                                disabled={loading}
                                className={cn(
                                    "w-full h-11 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-2",
                                    loading 
                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                                        : "bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 shadow-red-100"
                                )}
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>Limpiar Datos Demo</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
