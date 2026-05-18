"use client";

import React from "react";
import { Clock, Phone, MessageSquare, Bot, ArrowRight, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrchestratorSequenceStep } from "@/lib/actions/orchestrator-config";
import type { LucideIcon } from "lucide-react";

interface SequenceTimelineProps {
    sequence: OrchestratorSequenceStep[];
}

const ACTION_ICONS: Record<string, LucideIcon> = {
    call: Phone,
    whatsapp: MessageSquare,
    ai_agent: Bot,
    wait: Clock,
    zoho: Database,
};

const ACTION_COLORS: Record<string, string> = {
    call: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    whatsapp: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    ai_agent: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    wait: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    zoho: "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

export function SequenceTimeline({ sequence }: SequenceTimelineProps) {
    if (sequence.length === 0) return null;

    const projectSteps = [];
    let cumulative = 0;
    for (const step of sequence) {
        cumulative += step.delay_hours;
        const Icon = (ACTION_ICONS[step.action] || Phone) as LucideIcon;
        const color = ACTION_COLORS[step.action] || ACTION_COLORS.call;
        const days = Math.floor(cumulative / 24);
        const hours = cumulative % 24;
        
        projectSteps.push({
            ...step,
            Icon,
            color,
            timeLabel: days > 0 ? `+${days}d ${hours}h` : `+${hours}h`,
            isImmediate: cumulative === 0,
            cumulativeHours: cumulative
        });
    }

    const totalHours = cumulative;

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 overflow-x-auto">
            <div className="flex items-center gap-0 min-w-max pr-10">
                {projectSteps.map((step, idx) => (
                    <React.Fragment key={`${step.step}-${idx}`}>
                        {/* THE STEP NODE */}
                        <div className="relative flex flex-col items-center">
                            {/* Time Badge */}
                            <div className={cn(
                                "mb-4 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                step.isImmediate 
                                    ? "bg-primary/20 border-primary/30 text-primary animate-pulse" 
                                    : "bg-white/5 border-white/10 text-white/40"
                            )}>
                                {step.isImmediate ? "Inmediato" : step.timeLabel}
                            </div>

                            {/* Action Icon */}
                            <div className={cn(
                                "h-14 w-14 rounded-2xl border-2 flex items-center justify-center transition-all group-hover:scale-110",
                                step.color
                            )}>
                                <step.Icon className="h-6 w-6 shrink-0" />
                            </div>

                            {/* Step Label */}
                            <div className="mt-4 text-center">
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Paso {step.step}</p>
                                <p className="text-[10px] font-bold text-white/60 capitalize mt-1">{step.action}</p>
                            </div>
                        </div>

                        {/* CONNECTOR ARROW (if not last) */}
                        {idx < projectSteps.length - 1 && (
                            <div className="w-20 sm:w-32 flex items-center justify-center -mt-6">
                                <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                                <ArrowRight className="h-4 w-4 text-white/10 shrink-0 mx-2" />
                                <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
                            </div>
                        )}
                    </React.Fragment>
                ))}
                
                {/* FINAL STATE */}
                <div className="flex flex-col items-center ml-10 opacity-20">
                     <div className="mb-4 px-3 py-1 text-[10px] uppercase font-black tracking-widest">Fin</div>
                     <div className="h-14 w-14 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                         <div className="h-2 w-2 rounded-full bg-white/40" />
                     </div>
                </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest text-white/40">Duración estimada del ciclo de contacto:</span>
                </div>
                <span className="text-lg font-black text-primary">
                    {Math.floor(totalHours / 24)}d {totalHours % 24}h
                </span>
            </div>
        </div>
    );
}
