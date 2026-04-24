"use client";

import { useState } from "react";
import { SequenceCanvas } from "@/components/onboarding/SequenceCanvas";
import { WorkflowSidebar } from "@/components/onboarding/WorkflowSidebar";
import { Zap, Building2, Timer } from "lucide-react";
import { useTenantStore } from "@/store/tenant";
import { ReactFlowProvider } from "@xyflow/react";

/**
 * ONBOARDING — UNIFIED FLOW ORCHESTRATOR v5.0
 * Visual Flow Builder + System Configuration in a single hub.
 * 
 * ✅ Replaces /dashboard/orchestrator (now redirects here)
 * ✅ TimeCondition nodes with per-lead timezone adaptation
 * ✅ VoiceCall / TextAgent / WhatsApp specialized nodes
 * ✅ Global system config (schedule, working days) in sidebar
 * ✅ One-click Deploy System
 */
export default function OnboardingPage() {
    const { tenantId, tenantName, isConfigured } = useTenantStore();
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

    if (!isConfigured || !tenantId) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-center gap-6 animate-in fade-in duration-700">
                <div className="h-20 w-20 flex items-center justify-center rounded-3xl bg-primary/10 text-primary border border-primary/20 shadow-xl shadow-primary/10">
                    <Building2 className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-tight">Selecciona un Cliente</h2>
                    <p className="text-muted-foreground opacity-60 max-w-sm">
                        Debes seleccionar un cliente en el menú lateral para gestionar sus flujos de automatización.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] w-full overflow-hidden bg-black animate-in fade-in duration-1000">
            
            {/* ── Top Bar ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/60 backdrop-blur-xl z-[60] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/10">
                        <Zap className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black tracking-tight text-white/90 uppercase leading-none">
                            Flow Orchestrator
                            <span className="text-white/20 text-xs font-normal ml-2">{tenantName.toUpperCase()}</span>
                        </h1>
                        <p className="text-[10px] text-white/30 font-bold tracking-widest uppercase">
                            Unified Node Engine V5.0
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* System timezone hint */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[10px] text-yellow-500 font-bold uppercase tracking-wider">
                        <Timer className="h-3 w-3" />
                        Timezone Auto
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Production
                    </div>
                </div>
            </div>

            {/* ── Main Workspace: Sidebar + Canvas ────────────────── */}
            <div className="flex-1 flex overflow-hidden">
                <WorkflowSidebar 
                    tenantId={tenantId} 
                    selectedWorkflowId={selectedWorkflowId} 
                    onSelect={setSelectedWorkflowId} 
                />
                
                <div className="flex-1 relative bg-[#050505]">
                    {selectedWorkflowId ? (
                        <ReactFlowProvider key={selectedWorkflowId}>
                            <SequenceCanvas 
                                tenantId={tenantId} 
                                workflowId={selectedWorkflowId} 
                            />
                        </ReactFlowProvider>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-6 opacity-20">
                            <Zap className="h-16 w-16" />
                            <div className="space-y-2">
                                <p className="text-sm font-bold uppercase tracking-widest">Selecciona un Workflow</p>
                                <p className="text-xs opacity-60">O crea uno nuevo desde la barra lateral</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Status Bar ──────────────────────────────────────── */}
            <div className="px-6 py-2 border-t border-white/5 bg-black/60 flex items-center justify-between z-50 shrink-0">
                <div className="flex items-center gap-6 text-[10px] font-bold tracking-widest text-white/20 uppercase">
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Flow Engine: Operational
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                        Timezone: Auto-Resolve por Prefijo
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        Canales: Voice + WhatsApp + Text AI
                    </div>
                </div>
                <div className="text-[10px] font-mono text-white/10 italic">
                    Unified Orchestrator V5.0.0
                </div>
            </div>
        </div>
    );
}
