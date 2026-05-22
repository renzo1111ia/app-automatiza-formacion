import React from "react";
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  PhoneCall,
  Calendar,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadStageEnum } from "@/lib/schemas/_base";

export interface TraceabilityEvent {
  id: string;
  type: "WHATSAPP" | "CALL" | "CRM" | "STATUS_CHANGE";
  title: string;
  description: string;
  timestamp: string;
  status: "SUCCESS" | "FAILURE" | "PENDING";
  metadata?: Record<string, unknown>;
}

interface Props {
  currentStage: string;
  events: TraceabilityEvent[];
  leadMetadata: Record<string, unknown>;
}

const STAGES = [
  {
    key: LeadStageEnum.enum.QUALIFICATION,
    label: "Cualificación",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    key: LeadStageEnum.enum.SCHEDULING,
    label: "Agendamiento",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    key: LeadStageEnum.enum.COMPLETED,
    label: "Cita Confirmada",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
];

export function LeadTraceabilitySidebar({ currentStage, events, leadMetadata }: Props) {
  const activeStageIndex = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="bg-card flex h-full flex-col gap-8 p-2">
      {/* 1. STAGE TRACKER (Modern Horizontal Line) */}
      <section className="bg-muted/30 border-border rounded-[2rem] border p-6">
        <h4 className="text-muted-foreground mb-6 flex items-center gap-2 text-[10px] font-black tracking-widest uppercase">
          <TrendingUp className="h-3 w-3" /> Progreso de Etapa
        </h4>
        <div className="relative flex items-center justify-between px-2">
          <div className="bg-border absolute top-1/2 left-0 z-0 h-0.5 w-full -translate-y-1/2" />
          {STAGES.map((stage, idx) => {
            const isCompleted =
              idx < activeStageIndex || currentStage === LeadStageEnum.enum.COMPLETED;
            const isActive = idx === activeStageIndex;
            return (
              <div key={stage.key} className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-4 transition-all duration-500",
                    isCompleted
                      ? "border-emerald-100 bg-emerald-500 text-white"
                      : isActive
                        ? "bg-primary border-primary/20 animate-pulse text-white"
                        : "bg-card border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : stage.icon}
                </div>
                <span
                  className={cn(
                    "max-w-[60px] text-center text-[9px] font-black tracking-tighter uppercase",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. AI EXTRACTED FACTS (The Memory) */}
      <section className="border-border rounded-[2rem] border bg-slate-50 p-6 dark:bg-slate-900/40">
        <h4 className="text-muted-foreground mb-4 flex items-center gap-2 text-[10px] font-black tracking-widest uppercase">
          <AlertCircle className="h-3 w-3" /> Datos Extraídos (IA)
        </h4>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(leadMetadata).map(([key, value]) => {
            if (typeof value === "object" || key === "raw_payload") return null;
            return (
              <div
                key={key}
                className="bg-card border-border/50 flex flex-col rounded-2xl border p-3"
              >
                <span className="text-muted-foreground text-[8px] font-black uppercase">
                  {key.replace(/_/g, " ")}
                </span>
                <span className="text-card-foreground truncate text-xs font-bold">
                  {String(value)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. OMNICHANNEL TIMELINE */}
      <section className="flex flex-1 flex-col gap-4 overflow-hidden">
        <h4 className="text-muted-foreground flex items-center gap-2 px-2 text-[10px] font-black tracking-widest uppercase">
          <Calendar className="h-3 w-3" /> Timeline Omnicanal
        </h4>
        <div className="custom-scrollbar space-y-4 overflow-y-auto pr-2">
          {events.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-xs italic">
              Sin eventos registrados aún
            </p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="border-border relative border-l pb-4 pl-6 last:pb-0">
                <div
                  className={cn(
                    "border-card absolute top-0 -left-[5px] h-2.5 w-2.5 rounded-full border-2",
                    event.status === "SUCCESS"
                      ? "bg-emerald-500"
                      : event.status === "FAILURE"
                        ? "bg-rose-500"
                        : "bg-amber-500"
                  )}
                />
                <div className="bg-muted/30 hover:bg-muted/50 border-border rounded-2xl border p-4 transition-all">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {event.type === "WHATSAPP" && (
                        <MessageSquare className="h-3 w-3 text-emerald-500" />
                      )}
                      {event.type === "CALL" && <PhoneCall className="h-3 w-3 text-blue-500" />}
                      <span className="text-card-foreground text-[10px] font-black uppercase">
                        {event.title}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-[9px] font-bold">
                      {event.timestamp}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
                    {event.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
