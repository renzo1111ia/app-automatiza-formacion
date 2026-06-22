"use client";

import React, { useState, useEffect } from "react";
import { Bot, Mic, Check, ChevronsUpDown, ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAIAgents } from "@/lib/actions/agents";
import { getVoiceAgents } from "@/lib/actions/voice-agents";
import { AIAgent, VoiceAgent } from "@/types/database";
import Link from "next/link";

interface AgentSelectorProps {
  selectedAgentIds: string[];
  onToggleAgent: (agentId: string) => void;
  maxSelection?: number; // Default 2 for A/B testing
  mode?: "AI" | "VOICE";
}

export function AgentSelector({
  selectedAgentIds,
  onToggleAgent,
  maxSelection = 2,
  mode = "AI",
}: AgentSelectorProps) {
  const [agents, setAgents] = useState<(AIAgent | VoiceAgent)[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = mode === "AI" ? await getAIAgents() : await getVoiceAgents();
      if (res.success && res.data) {
        setAgents(res.data as (AIAgent | VoiceAgent)[]);
      } else {
        setAgents([]);
      }
      setLoading(false);
    }
    load();
  }, [mode]);

  const selectedAgents = agents.filter((a) => selectedAgentIds.includes(a.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-black tracking-widest text-white/40 uppercase">
          {mode === "AI"
            ? `Agentes de IA (A/B Testing con ${maxSelection})`
            : `Voces de Retell (A/B Testing con ${maxSelection})`}
        </label>
        <Link
          href={mode === "AI" ? "/dashboard/agents" : "/dashboard/voice-agents"}
          className="text-primary hover:text-primary/80 flex items-center gap-1 text-[9px] font-black tracking-widest uppercase transition-colors"
        >
          Gestionar {mode === "AI" ? "Agentes" : "Voces"} <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="group flex h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 transition-all hover:bg-white/[0.08]"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {mode === "AI" ? (
              <Bot className="group-hover:text-primary h-4 w-4 text-white/30 transition-colors" />
            ) : (
              <Mic className="h-4 w-4 text-purple-400 transition-colors group-hover:text-purple-300" />
            )}
            {selectedAgents.length > 0 ? (
              <div className="flex gap-1 overflow-hidden">
                {selectedAgents.map((agent) => (
                  <span
                    key={agent.id}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-white/80"
                  >
                    {agent.name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm font-medium text-white/20 italic">
                Seleccionar agentes...
              </span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 text-white/20" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="animate-in fade-in zoom-in-95 absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl duration-200">
              <div className="max-h-60 overflow-y-auto p-2">
                {loading ? (
                  <div className="flex justify-center p-4">
                    <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                ) : agents.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-xs text-white/30">No hay agentes creados.</p>
                    <Link
                      href="/dashboard/agents"
                      className="text-primary mt-2 inline-flex items-center gap-1 text-[10px] font-black tracking-widest uppercase"
                    >
                      <Plus className="h-3 w-3" /> Crear Agente
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-1">
                    {agents.map((agent) => {
                      const isSelected = selectedAgentIds.includes(agent.id);
                      const canSelectMore = selectedAgentIds.length < maxSelection;

                      return (
                        <button
                          key={agent.id}
                          type="button"
                          disabled={!isSelected && !canSelectMore}
                          onClick={() => onToggleAgent(agent.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl p-3 text-left transition-all",
                            isSelected
                              ? mode === "AI"
                                ? "bg-primary/20 border-primary/30 border"
                                : "border border-purple-500/30 bg-purple-500/20"
                              : "border border-transparent hover:bg-white/5",
                            !isSelected && !canSelectMore && "cursor-not-allowed opacity-40"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white/90">{agent.name}</p>
                            <p className="truncate text-[10px] font-black text-white/30 uppercase">
                              {"type" in agent ? agent.type : agent.provider}
                            </p>
                          </div>
                          {isSelected && (
                            <Check
                              className={cn(
                                "h-4 w-4",
                                mode === "AI" ? "text-primary" : "text-purple-400"
                              )}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {selectedAgentIds.length === 0 && (
        <p className="flex items-center gap-1 px-1 text-[10px] text-amber-400/60">
          Recuerda: Si no seleccionas agentes, el orquestador no podrá realizar acciones de IA.
        </p>
      )}
    </div>
  );
}
