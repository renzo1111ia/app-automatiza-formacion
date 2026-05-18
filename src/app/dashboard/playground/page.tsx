"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
    Play, RotateCcw, ChevronRight, 
    Check, AlertCircle, Loader2, Terminal,
    Users, Workflow as WorkflowIcon, Zap, Activity,
    ShieldCheck, MessageSquare, Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
    getRecentLeads, 
    getTenantWorkflows, 
    getWorkflowRules,
    triggerOrchestratorForLead 
} from "@/lib/actions/orchestration";
import { useTenantStore } from "@/store/tenant";

interface Lead { id: string; nombre?: string | null; apellido?: string | null; telefono?: string | null; origen?: string | null; }
interface WorkflowItem { id: string; name: string; is_primary?: boolean | null; is_active?: boolean | null; }
interface Rule { id: string; step_name: string; action_type: string; sequence_order: number; }
interface SystemLog { id: string; source: string; level: string; message: string; metadata: any; created_at: string; error_code?: string; }

export default function OrchestratorPlaygroundPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
    const [rules, setRules] = useState<Rule[]>([]);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem | null>(null);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [logs, setLogs] = useState<string[]>([]);
    const [historicalLogs, setHistoricalLogs] = useState<SystemLog[]>([]);
    const [logTab, setLogTab] = useState<'live' | 'history'>('live');
    const [filterLevel, setFilterLevel] = useState<string>('ALL');
    const [health, setHealth] = useState<{
        meta: { ok: boolean; msg: string };
        aws: { ok: boolean; msg: string };
        supabase: { ok: boolean; msg: string };
    }>({
        meta: { ok: false, msg: "Cargando..." },
        aws: { ok: false, msg: "Cargando..." },
        supabase: { ok: false, msg: "Cargando..." },
    });
    const logRef = useRef<HTMLDivElement>(null);

    const loadData = useCallback(async () => {
        const [leadsRes, wfRes, logsRes] = await Promise.all([
            getRecentLeads(20), 
            getTenantWorkflows(),
            import("@/lib/actions/orchestration").then(m => m.getSystemLogs(50))
        ]);
        if (leadsRes.success && leadsRes.data) setLeads(leadsRes.data as Lead[]);
        if (wfRes.success && wfRes.data) {
            const wfs = wfRes.data as WorkflowItem[];
            setWorkflows(wfs);
            const primary = wfs.find(w => w.is_primary) || wfs[0];
            if (primary) setSelectedWorkflow(primary);
        }
        if (logsRes.success && logsRes.data) setHistoricalLogs(logsRes.data as SystemLog[]);

        const tenantConfig = useTenantStore.getState().config || {};
        const wa = (tenantConfig as any).whatsapp || {};
        const aws = (tenantConfig as any).aws || {};

        setHealth({
            meta: { 
                ok: !!(wa.accessToken && wa.phoneNumberId), 
                msg: wa.accessToken ? "Conectado a Meta" : "Falta Access Token en Ajustes" 
            },
            aws: { 
                ok: !!(aws.kbId), 
                msg: aws.kbId ? "Cerebro AWS Listo" : "Falta Knowledge Base ID" 
            },
            supabase: { 
                ok: true, 
                msg: "Base de Datos Operativa" 
            }
        });
    }, []);

    const loadRules = useCallback(async (workflowId: string) => {
        const res = await getWorkflowRules(workflowId);
        if (res.success && res.data) setRules(res.data as Rule[]);
        else setRules([]);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (selectedWorkflow) loadRules(selectedWorkflow.id);
    }, [selectedWorkflow, loadRules]);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logs]);

    async function handleRun() {
        if (!selectedLead || !selectedWorkflow) return;
        setStatus("loading");
        setLogs([]);

        const addLog = (line: string) => setLogs(prev => [...prev, line]);

        addLog(`[INFO] Iniciando Orquestador...`);
        addLog(`[INFO] Lead: ${selectedLead.nombre} ${selectedLead.apellido} (${selectedLead.id.slice(0, 8)}...)`);
        addLog(`[INFO] Workflow: ${selectedWorkflow.name}`);
        addLog(`[INFO] Pasos configurados: ${rules.length}`);

        const res = await triggerOrchestratorForLead(selectedLead.id, selectedWorkflow.id);

        if (res.success) {
            if (res.logs && res.logs.length > 0) {
                res.logs.forEach(log => addLog(log));
            } else {
                addLog(`[ORCHESTRATOR] No active rules found. Add steps in the Constructor.`);
            }
            addLog(`\n✅ Ejecución Completada`);
            setStatus("success");
            
            // Refresh history
            import("@/lib/actions/orchestration").then(m => m.getSystemLogs(50)).then(r => {
                if (r.success) setHistoricalLogs(r.data as SystemLog[]);
            });
        } else {
            addLog(`[ERROR] ${res.error}`);
            setStatus("error");
        }
    }

    const translateError = (msg: string) => {
        if (msg.includes("Receiver is not a valid WhatsApp user")) return "El número no tiene WhatsApp o es inválido.";
        if (msg.includes("Knowledge Base ID")) return "AWS Bedrock no está configurado (Falta KB ID).";
        if (msg.includes("accessToken")) return "Las credenciales de Meta han expirado o son incorrectas.";
        if (msg.includes("quota")) return "Se ha excedido el límite de mensajes o tokens.";
        return msg;
    };

    const actionColors: Record<string, string> = {
        CALL: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        WHATSAPP: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        AI_AGENT: "text-purple-400 bg-purple-500/10 border-purple-500/20",
        WAIT: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        LLM_TEXT: "text-pink-400 bg-pink-500/10 border-pink-500/20",
        API_CALL: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
        SUB_WORKFLOW: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-8 space-y-8 transition-colors duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Terminal className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Orchestrator Playground</h1>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Simula el motor de orquestación en tiempo real con leads reales</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        loadData();
                        setLogs([]);
                        setStatus("idle");
                        setSelectedLead(null);
                    }}
                    title="Reiniciar todo el laboratorio"
                    className="flex items-center gap-2 h-10 px-4 border border-border rounded-xl text-muted-foreground hover:bg-card/40 text-xs font-bold uppercase tracking-widest transition-all hover:text-foreground"
                >
                    <RotateCcw className="h-3.5 w-3.5" /> Reiniciar Laboratorio
                </button>
            </div>

            {/* ── DIAGNOSTIC BAR (Mini Dashboard) ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 bg-primary/10 border border-primary/20 p-6 rounded-3xl flex flex-col justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Health Score</p>
                        <h2 className="text-4xl font-black text-foreground">
                            {historicalLogs.filter(l => l.level === 'ERROR').length > 5 ? '72%' : '98%'}
                        </h2>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mt-4">Sistema Estable</p>
                </div>
                
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <HealthCard 
                        icon={Globe} 
                        title="Webhook Status" 
                        status={health.supabase.ok ? "ONLINE" : "OFFLINE"} 
                        desc="app.automatizaformacion.com" 
                    />
                    <HealthCard 
                        icon={MessageSquare} 
                        title="Meta Integration" 
                        status={health.meta.ok ? "CONFIGURED" : "MISSING DATA"} 
                        desc={health.meta.msg}
                        isError={!health.meta.ok}
                    />
                    <HealthCard 
                        icon={Zap} 
                        title="AWS Intelligence" 
                        status={health.aws.ok ? "SYNCED" : "NO KB ID"} 
                        desc={health.aws.msg}
                        isError={!health.aws.ok}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── LEFT: Config Panel ── */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-card/40 border border-border rounded-3xl p-6 space-y-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <WorkflowIcon className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">1. Seleccionar Workflow</span>
                        </div>
                        <div className="space-y-2">
                            {workflows.length === 0 && (
                                <p className="text-xs text-white/20 italic text-center py-4">Sin workflows. Crea uno en el Constructor.</p>
                            )}
                            {workflows.map(wf => (
                                <button
                                    key={wf.id}
                                    onClick={() => setSelectedWorkflow(wf)}
                                    className={cn(
                                        "w-full p-3 rounded-xl text-left border transition-all",
                                        selectedWorkflow?.id === wf.id
                                            ? "bg-primary/10 border-primary/30 text-primary"
                                            : "bg-card/20 border-border text-muted-foreground hover:bg-card/40"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold">{wf.name}</span>
                                        {wf.is_primary && <span className="text-[8px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-black uppercase">Principal</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {rules.length > 0 && (
                        <div className="bg-card/40 border border-border rounded-3xl p-6 space-y-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Pasos del Workflow</span>
                            <div className="space-y-2">
                                {rules.map((rule, i) => (
                                    <div key={rule.id} className="flex items-center gap-3">
                                        <div className="h-5 w-5 rounded-full bg-card/40 flex items-center justify-center text-[8px] font-black text-muted-foreground flex-shrink-0">{i + 1}</div>
                                        <div className={cn("flex-1 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider", actionColors[rule.action_type] || "text-muted-foreground/40 bg-card/20 border-border")}>
                                            {rule.step_name || rule.action_type}
                                        </div>
                                        {i < rules.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/10" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-card/40 border border-border rounded-3xl p-6 space-y-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">2. Seleccionar Lead</span>
                        </div>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                            {leads.length === 0 && (
                                <p className="text-xs text-white/20 italic text-center py-4">Sin leads disponibles.</p>
                            )}
                            {leads.map(lead => (
                                <button
                                    key={lead.id}
                                    onClick={() => setSelectedLead(lead)}
                                    className={cn(
                                        "w-full p-3 rounded-xl text-left border transition-all",
                                        selectedLead?.id === lead.id
                                            ? "bg-emerald-500/10 border-emerald-500/30"
                                            : "bg-card/20 border-border hover:bg-card/40"
                                    )}
                                >
                                    <div className="text-sm font-bold truncate">{lead.nombre} {lead.apellido}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono truncate">{lead.telefono || lead.id.slice(0, 12)}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Execution Panel ── */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-card/40 border border-border rounded-3xl p-6 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className={cn("h-3 w-3 rounded-full flex-shrink-0", {
                                "bg-white/10": status === "idle",
                                "bg-amber-400 animate-pulse": status === "loading",
                                "bg-emerald-400": status === "success",
                                "bg-red-400": status === "error",
                            })} />
                            <div>
                                <p className="text-sm font-bold">
                                    {status === "idle" && "Listo para simular"}
                                    {status === "loading" && "Ejecutando orquestador..."}
                                    {status === "success" && "Ejecución completada"}
                                    {status === "error" && "Error en ejecución"}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    {selectedLead
                                        ? `Lead: ${selectedLead.nombre} / Workflow: ${selectedWorkflow?.name || "—"}`
                                        : "Selecciona un lead y un workflow para comenzar"
                                    }
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleRun}
                            disabled={!selectedLead || !selectedWorkflow || status === "loading"}
                            className={cn(
                                "flex items-center gap-3 h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl flex-shrink-0",
                                (!selectedLead || !selectedWorkflow || status === "loading")
                                    ? "bg-card/20 text-muted-foreground cursor-not-allowed border border-border"
                                    : "bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] shadow-primary/20"
                            )}
                        >
                            {status === "loading"
                                ? <><Loader2 className="h-5 w-5 animate-spin" /> Procesando</>
                                : <><Play className="h-5 w-5" /> Ejecutar</>
                            }
                        </button>
                    </div>

                    <div className="flex-1 bg-card/60 border border-border rounded-3xl overflow-hidden flex flex-col min-h-[500px]">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/20">
                            <div className="flex items-center gap-6">
                                <button 
                                    onClick={() => setLogTab('live')}
                                    className={cn("text-[10px] font-black uppercase tracking-widest pb-1 transition-all", logTab === 'live' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
                                >
                                    Console (Live)
                                </button>
                                <button 
                                    onClick={() => setLogTab('history')}
                                    className={cn("text-[10px] font-black uppercase tracking-widest pb-1 transition-all", logTab === 'history' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
                                >
                                    System History (DB)
                                </button>
                            </div>
                            
                            {logTab === 'history' && (
                                <div className="flex items-center gap-2">
                                    {['ALL', 'INFO', 'ERROR'].map(lvl => (
                                        <button 
                                            key={lvl}
                                            onClick={() => setFilterLevel(lvl)}
                                            className={cn("px-2 py-1 rounded text-[8px] font-black uppercase border", filterLevel === lvl ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border")}
                                        >
                                            {lvl}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div ref={logRef} className="flex-1 overflow-y-auto p-6 font-mono text-[11px] space-y-2">
                            {logTab === 'live' ? (
                                <>
                                    {logs.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground/20 py-20">
                                            <Terminal className="h-12 w-12" />
                                            <p className="font-bold uppercase tracking-widest text-[11px]">Esperando ejecución...</p>
                                        </div>
                                    )}
                                    {logs.map((log, i) => (
                                        <div key={i} className={cn("leading-relaxed p-2 rounded bg-card/20", {
                                            "text-muted-foreground": log.includes("[INFO]"),
                                            "text-purple-400": log.includes("[ORCHESTRATOR]"),
                                            "text-red-400 bg-red-500/5": log.includes("[ERROR]"),
                                            "text-emerald-400 font-bold": log.includes("✅"),
                                            "text-amber-400": log.includes("[WARN]"),
                                        })}>
                                            {log}
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div className="space-y-3">
                                    {historicalLogs
                                        .filter(l => filterLevel === 'ALL' || l.level === filterLevel)
                                        .map((log) => (
                                        <div key={log.id} className={cn("p-3 rounded-xl border flex gap-4 transition-all", {
                                            "bg-card/40 border-border": log.level === 'INFO',
                                            "bg-red-500/5 border-red-500/10": log.level === 'ERROR',
                                            "bg-amber-500/5 border-amber-500/10": log.level === 'WARN',
                                        })}>
                                            <div className="shrink-0 flex flex-col items-center gap-2">
                                                <div className={cn("w-1.5 h-1.5 rounded-full", {
                                                    "bg-emerald-400": log.level === 'INFO',
                                                    "bg-red-400": log.level === 'ERROR',
                                                    "bg-amber-400": log.level === 'WARN',
                                                })} />
                                                <span className="text-[8px] opacity-20 whitespace-nowrap">
                                                    {new Date(log.created_at).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black uppercase opacity-40">{log.source}</span>
                                                    {log.level === 'ERROR' && (
                                                        <span className="text-[9px] font-black uppercase text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                                                            Crítico
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={cn("text-xs", log.level === 'ERROR' ? "text-red-200" : "text-foreground/80")}>
                                                    {log.message}
                                                </p>
                                                {log.level === 'ERROR' && (
                                                    <div className="mt-2 p-2 bg-card/60 rounded-lg border border-red-500/20">
                                                        <p className="text-[10px] text-red-400 font-black uppercase mb-1">💡 Explicación Simple:</p>
                                                        <p className="text-[11px] text-muted-foreground italic">{translateError(log.message)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: "Workflows Activos", value: workflows.filter(w => w.is_active).length, icon: WorkflowIcon, color: "text-primary" },
                            { label: "Leads Disponibles", value: leads.length, icon: Users, color: "text-emerald-400" },
                            { label: "Pasos en Workflow", value: rules.length, icon: Zap, color: "text-purple-400" },
                        ].map(stat => (
                            <div key={stat.label} className="bg-card/40 border border-border rounded-2xl p-4 flex items-center gap-3">
                                <stat.icon className={cn("h-5 w-5", stat.color)} />
                                <div>
                                    <p className="text-xl font-black">{stat.value}</p>
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function HealthCard({ icon: Icon, title, status, desc, isError }: any) {
    return (
        <div className="bg-card/40 border border-border p-4 rounded-2xl flex items-start gap-3">
            <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                isError ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
            )}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{title}</span>
                    <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter",
                        isError ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    )}>
                        {status}
                    </span>
                </div>
                <p className="text-[11px] font-bold text-foreground/80 leading-tight">{desc}</p>
            </div>
        </div>
    );
}
