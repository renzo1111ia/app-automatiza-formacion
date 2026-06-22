"use client";

import React, { useState, useEffect } from "react";
import { Mic, Check, ChevronsUpDown, ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVoiceAgents } from "@/lib/actions/voice-agents";
import { VoiceAgent } from "@/types/database";
import Link from "next/link";

interface VoiceAgentSelectorProps {
  selectedAgentId: string | null;
  onChange: (agentId: string, agentName?: string) => void;
}

export function VoiceAgentSelector({ selectedAgentId, onChange }: VoiceAgentSelectorProps) {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getVoiceAgents();
      if (res.success && res.data) {
        setAgents(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <label className="text-[9px] font-black tracking-widest text-white/40 uppercase">
          Vincular Agente de Voz
        </label>
        <Link
          href="/dashboard/voice-agents"
          className="flex items-center gap-1 text-[9px] font-black tracking-widest text-purple-400 uppercase transition-colors hover:text-purple-300"
        >
          Gestionar Voces <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="group flex h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 transition-all hover:bg-white/[0.08]"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Mic className="h-4 w-4 text-purple-400/50 transition-colors group-hover:text-purple-400" />
            {selectedAgent ? (
              <span className="text-xs font-bold whitespace-nowrap text-white/80">
                {selectedAgent.name}
              </span>
            ) : (
              <span className="text-sm font-medium text-white/20 italic">
                Seleccionar agente de voz...
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
                  <div className="flex justify-center p-4 text-purple-400">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  </div>
                ) : agents.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-xs text-white/30">No hay agentes de voz creados.</p>
                    <Link
                      href="/dashboard/voice-agents"
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-black tracking-widest text-purple-400 uppercase"
                    >
                      <Plus className="h-3 w-3" /> Crear Agente Voz
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-1">
                    {agents.map((agent) => {
                      const isSelected = selectedAgentId === agent.id;

                      return (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => {
                            onChange(agent.id, agent.name);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl p-3 text-left transition-all",
                            isSelected
                              ? "border border-purple-500/30 bg-purple-500/20"
                              : "border border-transparent hover:bg-white/5"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-bold text-white/90">
                                {agent.name}
                              </p>
                              <span className="rounded bg-white/5 px-1 py-0.5 text-[7px] leading-none font-black tracking-widest text-white/40 uppercase">
                                {agent.provider}
                              </span>
                            </div>
                            <p className="truncate text-[10px] font-medium text-white/30 lowercase italic">
                              {agent.voice_id || "Voz predeterminada"}
                            </p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-purple-400" />}
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

      {!selectedAgentId && (
        <p className="flex items-center gap-1 px-1 text-[10px] text-amber-400/60">
          Nota: Las llamadas requieren un agente configurado para definir la voz y el script.
        </p>
      )}
    </div>
  );
}
