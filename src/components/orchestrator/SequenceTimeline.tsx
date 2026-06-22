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
      cumulativeHours: cumulative,
    });
  }

  const totalHours = cumulative;

  return (
    <div className="overflow-x-auto rounded-[40px] border border-white/5 bg-white/[0.02] p-8">
      <div className="flex min-w-max items-center gap-0 pr-10">
        {projectSteps.map((step, idx) => (
          <React.Fragment key={`${step.step}-${idx}`}>
            {/* THE STEP NODE */}
            <div className="relative flex flex-col items-center">
              {/* Time Badge */}
              <div
                className={cn(
                  "mb-4 rounded-full border px-3 py-1 text-[10px] font-black tracking-widest whitespace-nowrap uppercase transition-all",
                  step.isImmediate
                    ? "bg-primary/20 border-primary/30 text-primary animate-pulse"
                    : "border-white/10 bg-white/5 text-white/40"
                )}
              >
                {step.isImmediate ? "Inmediato" : step.timeLabel}
              </div>

              {/* Action Icon */}
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition-all group-hover:scale-110",
                  step.color
                )}
              >
                <step.Icon className="h-6 w-6 shrink-0" />
              </div>

              {/* Step Label */}
              <div className="mt-4 text-center">
                <p className="text-[9px] font-black tracking-widest text-white/20 uppercase">
                  Paso {step.step}
                </p>
                <p className="mt-1 text-[10px] font-bold text-white/60 capitalize">{step.action}</p>
              </div>
            </div>

            {/* CONNECTOR ARROW (if not last) */}
            {idx < projectSteps.length - 1 && (
              <div className="-mt-6 flex w-20 items-center justify-center sm:w-32">
                <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                <ArrowRight className="mx-2 h-4 w-4 shrink-0 text-white/10" />
                <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
              </div>
            )}
          </React.Fragment>
        ))}

        {/* FINAL STATE */}
        <div className="ml-10 flex flex-col items-center opacity-20">
          <div className="mb-4 px-3 py-1 text-[10px] font-black tracking-widest uppercase">Fin</div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-white/20">
            <div className="h-2 w-2 rounded-full bg-white/40" />
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4 border-t border-white/5 pt-6">
        <div className="flex items-center gap-2">
          <Clock className="text-primary h-4 w-4" />
          <span className="text-xs font-black tracking-widest text-white/40 uppercase">
            Duración estimada del ciclo de contacto:
          </span>
        </div>
        <span className="text-primary text-lg font-black">
          {Math.floor(totalHours / 24)}d {totalHours % 24}h
        </span>
      </div>
    </div>
  );
}
