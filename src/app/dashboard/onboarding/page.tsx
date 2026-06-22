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
      <div className="animate-in fade-in flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 text-center duration-700">
        <div className="bg-primary/10 text-primary border-primary/20 shadow-primary/10 flex h-20 w-20 items-center justify-center rounded-3xl border shadow-xl">
          <Building2 className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight uppercase">Selecciona un Cliente</h2>
          <p className="text-muted-foreground max-w-sm opacity-60">
            Debes seleccionar un cliente en el menú lateral para gestionar sus flujos de
            automatización.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background animate-in fade-in flex h-[calc(100vh-2rem)] w-full flex-col overflow-hidden duration-1000">
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div className="border-border bg-card/60 z-[60] flex shrink-0 items-center justify-between border-b px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary border-primary/20 shadow-primary/10 flex h-9 w-9 items-center justify-center rounded-xl border shadow-lg">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-foreground text-xl leading-none font-black tracking-tight uppercase">
              Flow Orchestrator
              <span className="text-muted-foreground/40 ml-2 text-xs font-normal">
                {tenantName.toUpperCase()}
              </span>
            </h1>
            <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
              Unified Node Engine V5.0
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* System timezone hint */}
          <div className="flex items-center gap-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 text-[10px] font-bold tracking-wider text-yellow-500 uppercase">
            <Timer className="h-3 w-3" />
            Timezone Auto
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Production
          </div>
        </div>
      </div>

      {/* ── Main Workspace: Sidebar + Canvas ────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <WorkflowSidebar
          tenantId={tenantId}
          selectedWorkflowId={selectedWorkflowId}
          onSelect={setSelectedWorkflowId}
        />

        <div className="bg-background/50 relative flex-1">
          {selectedWorkflowId ? (
            <ReactFlowProvider key={selectedWorkflowId}>
              <SequenceCanvas tenantId={tenantId} workflowId={selectedWorkflowId} />
            </ReactFlowProvider>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center opacity-20">
              <Zap className="h-16 w-16" />
              <div className="space-y-2">
                <p className="text-sm font-bold tracking-widest uppercase">
                  Selecciona un Workflow
                </p>
                <p className="text-xs opacity-60">O crea uno nuevo desde la barra lateral</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ──────────────────────────────────────── */}
      <div className="border-border bg-card/60 z-50 flex shrink-0 items-center justify-between border-t px-6 py-2">
        <div className="text-muted-foreground flex items-center gap-6 text-[10px] font-bold tracking-widest uppercase">
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
        <div className="text-muted-foreground/20 font-mono text-[10px] italic">
          Unified Orchestrator V5.0.0
        </div>
      </div>
    </div>
  );
}
