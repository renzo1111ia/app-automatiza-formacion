"use client";

import React, { useEffect, useState } from "react";
import { 
    Plus, FolderTree, Zap, ChevronRight, Trash2,
    Settings2, Sun, Moon, Rocket, Globe2, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrchestratorConfig, saveOrchestratorConfig } from "@/lib/actions/orchestrator-config";
import { runSystemDeployment } from "@/lib/actions/system";

interface Workflow {
    id: string;
    name: string;
    description: string;
    is_primary: boolean;
}

interface WorkflowSidebarProps {
    tenantId: string;
    selectedWorkflowId: string | null;
    onSelect: (id: string) => void;
}

const DAYS_MAP = [
    { value: 0, label: "D" },
    { value: 1, label: "L" },
    { value: 2, label: "M" },
    { value: 3, label: "X" },
    { value: 4, label: "J" },
    { value: 5, label: "V" },
    { value: 6, label: "S" },
];

export function WorkflowSidebar({ tenantId, selectedWorkflowId, onSelect }: WorkflowSidebarProps) {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [configOpen, setConfigOpen] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);

    // ── Orchestrator Global Config ───────────────────────────────
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("20:00");
    const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);

    useEffect(() => {
        const loadWorkflows = async () => {
            try {
                const res = await fetch(`/api/orchestration/workflows?tenantId=${tenantId}`);
                if (res.ok) {
                    const data = await res.json();
                    setWorkflows(data);
                    if (!selectedWorkflowId && data.length > 0) {
                        const primary = data.find((w: Workflow) => w.is_primary) || data[0];
                        onSelect(primary.id);
                    }
                }
            } catch (error) {
                console.error("Failed to load workflows:", error);
            } finally {
                setLoading(false);
            }
        };
        loadWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantId]);

    // Load orchestrator config for timezone section
    useEffect(() => {
        async function loadConfig() {
            const res = await getOrchestratorConfig();
            if (res.success && res.data) {
                setStartTime(res.data.timezone_rules.start || "09:00");
                setEndTime(res.data.timezone_rules.end || "20:00");
                setWorkingDays(res.data.timezone_rules.working_days || [1,2,3,4,5]);
            }
        }
        loadConfig();
    }, []);

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        await saveOrchestratorConfig({
            timezone_rules: {
                start: startTime,
                end: endTime,
                working_days: workingDays,
                phone_prefix_map: {
                    "+34": "Europe/Madrid",
                    "+56": "America/Santiago",
                    "+52": "America/Mexico_City",
                    "+57": "America/Bogota",
                    "+51": "America/Lima",
                    "+54": "America/Argentina/Buenos_Aires",
                    "+598": "America/Montevideo",
                    "+1":  "America/New_York",
                    "+44": "Europe/London",
                }
            }
        });
        setSavingConfig(false);
    };

    const handleDeploy = async () => {
        setDeploying(true);
        try {
            await handleSaveConfig();
            const res = await runSystemDeployment();
            if (res.success) {
                alert("✅ " + res.message);
            } else {
                alert("❌ Error: " + res.error);
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            alert("Error: " + error.message);
        } finally {
            setDeploying(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("¿Estás seguro de que deseas eliminar este workflow? Esta acción no se puede deshacer.")) return;
        try {
            const res = await fetch(`/api/orchestration/workflows?id=${id}&tenantId=${tenantId}`, { method: 'DELETE' });
            if (res.ok) {
                const updatedWfs = workflows.filter(wf => wf.id !== id);
                setWorkflows(updatedWfs);
                if (selectedWorkflowId === id) {
                    onSelect(updatedWfs.length > 0 ? updatedWfs[0].id : "");
                }
            } else {
                const errData = await res.json();
                alert(`Error al eliminar: ${errData.error || res.statusText}`);
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            alert(`Error de red: ${error.message}`);
        }
    };

    const handleCreate = async () => {
        const name = prompt("Nombre del nuevo workflow:");
        if (!name) return;
        try {
            const res = await fetch('/api/orchestration/workflows', {
                method: 'POST',
                body: JSON.stringify({ tenantId, name })
            });
            if (res.ok) {
                const newWf = await res.json();
                setWorkflows([newWf, ...workflows]);
                onSelect(newWf.id);
            } else {
                const errData = await res.json();
                alert(`Error al crear: ${errData.error || res.statusText}`);
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            alert(`Error de red: ${error.message}`);
        }
    };

    return (
        <div className="w-72 border-r border-slate-200 dark:border-white/5 bg-white/80 dark:bg-black/60 backdrop-blur-3xl flex flex-col h-full animate-in slide-in-from-left duration-500">
            
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="p-5 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500 dark:text-white/40">
                    <FolderTree className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Colecciones</span>
                </div>
                <button 
                    onClick={handleCreate}
                    title="Crear nuevo flujo"
                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>

            {/* ── Workflow List ────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loading ? (
                    <div className="space-y-3 px-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                        ))}
                    </div>
                ) : workflows.length === 0 ? (
                    <div className="text-center py-8 space-y-3">
                        <Zap className="h-8 w-8 mx-auto text-slate-300 dark:text-white/10" />
                        <p className="text-[10px] text-slate-400 dark:text-white/20 font-bold uppercase tracking-widest">Sin workflows</p>
                        <button
                            onClick={handleCreate}
                            className="text-[10px] font-black text-primary hover:underline"
                        >+ Crear primero</button>
                    </div>
                ) : workflows.map((wf) => (
                    <div 
                        key={wf.id}
                        onClick={() => onSelect(wf.id)}
                        className={cn(
                            "group relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                            selectedWorkflowId === wf.id 
                                ? "bg-primary/10 border-primary/20 text-primary shadow-lg shadow-primary/5" 
                                : "bg-slate-100 dark:bg-white/[0.02] border-transparent dark:border-white/5 text-slate-500 dark:text-white/40 hover:bg-slate-200 dark:hover:bg-white/5 dark:hover:border-white/10"
                        )}
                    >
                        <div className={cn(
                            "h-8 w-8 flex items-center justify-center rounded-lg transition-colors shrink-0",
                            selectedWorkflowId === wf.id ? "bg-primary text-primary-foreground" : "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-white/20 group-hover:text-slate-600 dark:group-hover:text-white/40"
                        )}>
                            <Zap className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={cn(
                                "text-sm font-bold truncate transition-colors",
                                selectedWorkflowId === wf.id ? "text-slate-900 dark:text-white" : "group-hover:text-slate-700 dark:group-hover:text-white/60"
                            )}>
                                {wf.name}
                            </p>
                            {wf.is_primary && (
                                <span className="text-[9px] font-black uppercase tracking-tighter opacity-40">Default Entry</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={(e) => handleDelete(e, wf.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-500 transition-all"
                                title="Eliminar workflow"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <ChevronRight className={cn(
                                "h-4 w-4 transition-all",
                                selectedWorkflowId === wf.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                            )} />
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Global System Config ─────────────────────────────── */}
            <div className="border-t border-slate-200 dark:border-white/5">
                <button
                    onClick={() => setConfigOpen(!configOpen)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2 text-slate-500 dark:text-white/40">
                        <Settings2 className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Config. Sistema</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-slate-400 dark:text-white/20 transition-transform duration-300", configOpen && "rotate-180")} />
                </button>

                {configOpen && (
                    <div className="px-5 pb-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        {/* Time range */}
                        <div className="space-y-2">
                            <p className="text-[9px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">Horario de Activación</p>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2">
                                    <Sun className="h-3 w-3 text-emerald-400 shrink-0" />
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="bg-transparent text-emerald-400 text-xs font-black w-full outline-none [color-scheme:dark]"
                                        title="Hora inicio"
                                    />
                                </div>
                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2">
                                    <Moon className="h-3 w-3 text-blue-400 shrink-0" />
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="bg-transparent text-blue-400 text-xs font-black w-full outline-none [color-scheme:dark]"
                                        title="Hora fin"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Working days */}
                        <div className="space-y-2">
                            <p className="text-[9px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">Días Laborables</p>
                            <div className="flex gap-1">
                                {DAYS_MAP.map(d => {
                                    const isActive = workingDays.includes(d.value);
                                    return (
                                        <button
                                            key={d.value}
                                            onClick={() => {
                                                const updated = isActive
                                                    ? workingDays.filter(x => x !== d.value)
                                                    : [...workingDays, d.value].sort();
                                                setWorkingDays(updated);
                                            }}
                                            className={cn(
                                                "flex-1 h-8 rounded-lg text-[10px] font-black transition-all border",
                                                isActive
                                                    ? "bg-primary/20 border-primary/40 text-primary"
                                                    : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-white/20 hover:text-slate-600 dark:hover:text-white/40"
                                            )}
                                        >
                                            {d.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Timezone note */}
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                            <Globe2 className="h-3.5 w-3.5 text-cyan-500/60 mt-0.5 shrink-0" />
                            <p className="text-[9px] text-slate-500 dark:text-white/30 leading-relaxed">
                                El sistema adapta el horario al huso horario del lead según su prefijo telefónico (+34 España, +52 México, etc.)
                            </p>
                        </div>

                        {/* Save config */}
                        <button
                            onClick={handleSaveConfig}
                            disabled={savingConfig}
                            className="w-full h-9 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/50 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white/80 transition-all disabled:opacity-40"
                        >
                            {savingConfig ? "Guardando..." : "Guardar Configuración"}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Deploy Button ────────────────────────────────────── */}
            <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
                <button
                    onClick={handleDeploy}
                    disabled={deploying}
                    className={cn(
                        "w-full h-12 flex items-center justify-center gap-2 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-lg",
                        "bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] shadow-primary/20 disabled:opacity-50 disabled:cursor-wait"
                    )}
                >
                    <Rocket className={cn("h-4 w-4", deploying && "animate-bounce")} />
                    {deploying ? "Desplegando..." : "Desplegar Sistema"}
                </button>
            </div>
        </div>
    );
}
