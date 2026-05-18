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

export function VoiceAgentSelector({ 
    selectedAgentId, 
    onChange 
}: VoiceAgentSelectorProps) {
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

    const selectedAgent = agents.find(a => a.id === selectedAgentId);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">
                    Vincular Agente de Voz
                </label>
                <Link 
                    href="/dashboard/voice-agents" 
                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
                >
                    Gestionar Voces <ExternalLink className="h-2.5 w-2.5" />
                </Link>
            </div>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 flex items-center justify-between hover:bg-white/[0.08] transition-all group"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Mic className="h-4 w-4 text-purple-400/50 group-hover:text-purple-400 transition-colors" />
                        {selectedAgent ? (
                            <span className="text-xs font-bold text-white/80 whitespace-nowrap">
                                {selectedAgent.name}
                            </span>
                        ) : (
                            <span className="text-sm text-white/20 font-medium italic">Seleccionar agente de voz...</span>
                        )}
                    </div>
                    <ChevronsUpDown className="h-4 w-4 text-white/20" />
                </button>

                {isOpen && (
                    <>
                        <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsOpen(false)} 
                        />
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="max-h-60 overflow-y-auto p-2">
                                {loading ? (
                                    <div className="p-4 flex justify-center text-purple-400">
                                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                    </div>
                                ) : agents.length === 0 ? (
                                    <div className="p-4 text-center">
                                        <p className="text-xs text-white/30">No hay agentes de voz creados.</p>
                                        <Link 
                                            href="/dashboard/voice-agents" 
                                            className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-purple-400"
                                        >
                                            <Plus className="h-3 w-3" /> Crear Agente Voz
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="grid gap-1">
                                        {agents.map(agent => {
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
                                                        "w-full flex items-center justify-between p-3 rounded-xl transition-all text-left",
                                                        isSelected 
                                                            ? "bg-purple-500/20 border border-purple-500/30" 
                                                            : "hover:bg-white/5 border border-transparent"
                                                    )}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-white/90 truncate">{agent.name}</p>
                                                            <span className="text-[7px] font-black bg-white/5 px-1 rounded text-white/40 uppercase tracking-widest leading-none py-0.5">{agent.provider}</span>
                                                        </div>
                                                        <p className="text-[10px] text-white/30 lowercase font-medium truncate italic">{agent.voice_id || "Voz predeterminada"}</p>
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
                <p className="text-[10px] text-amber-400/60 flex items-center gap-1 px-1">
                    Nota: Las llamadas requieren un agente configurado para definir la voz y el script.
                </p>
            )}
        </div>
    );
}
