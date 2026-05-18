import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  PhoneCall, 
  Calendar,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TraceabilityEvent {
    id: string;
    type: 'WHATSAPP' | 'CALL' | 'CRM' | 'STATUS_CHANGE';
    title: string;
    description: string;
    timestamp: string;
    status: 'SUCCESS' | 'FAILURE' | 'PENDING';
    metadata?: Record<string, unknown>;
}

interface Props {
    currentStage: string;
    events: TraceabilityEvent[];
    leadMetadata: Record<string, unknown>;
}

const STAGES = [
    { key: 'QUALIFICATION', label: 'Cualificación', icon: <MessageSquare className="h-4 w-4" /> },
    { key: 'SCHEDULING', label: 'Agendamiento', icon: <Clock className="h-4 w-4" /> },
    { key: 'COMPLETED', label: 'Cita Confirmada', icon: <CheckCircle2 className="h-4 w-4" /> }
];

export function LeadTraceabilitySidebar({ currentStage, events, leadMetadata }: Props) {
    const activeStageIndex = STAGES.findIndex(s => s.key === currentStage);

    return (
        <div className="flex flex-col gap-8 h-full bg-card p-2">
            {/* 1. STAGE TRACKER (Modern Horizontal Line) */}
            <section className="bg-muted/30 rounded-[2rem] p-6 border border-border">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" /> Progreso de Etapa
                </h4>
                <div className="flex items-center justify-between relative px-2">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -translate-y-1/2 z-0" />
                    {STAGES.map((stage, idx) => {
                        const isCompleted = idx < activeStageIndex || currentStage === 'COMPLETED';
                        const isActive = idx === activeStageIndex;
                        return (
                            <div key={stage.key} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center border-4 transition-all duration-500",
                                    isCompleted ? "bg-emerald-500 border-emerald-100 text-white" :
                                    isActive ? "bg-primary border-primary/20 text-white animate-pulse" :
                                    "bg-card border-border text-muted-foreground"
                                )}>
                                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : stage.icon}
                                </div>
                                <span className={cn(
                                    "text-[9px] font-black uppercase tracking-tighter text-center max-w-[60px]",
                                    isActive ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {stage.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 2. AI EXTRACTED FACTS (The Memory) */}
            <section className="bg-slate-50 dark:bg-slate-900/40 rounded-[2rem] p-6 border border-border">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" /> Datos Extraídos (IA)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    {Object.entries(leadMetadata).map(([key, value]) => {
                        if (typeof value === 'object' || key === 'raw_payload') return null;
                        return (
                            <div key={key} className="flex flex-col p-3 rounded-2xl bg-card border border-border/50">
                                <span className="text-[8px] font-black text-muted-foreground uppercase">{key.replace(/_/g, ' ')}</span>
                                <span className="text-xs font-bold text-card-foreground truncate">{String(value)}</span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 3. OMNICHANNEL TIMELINE */}
            <section className="flex-1 overflow-hidden flex flex-col gap-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
                    <Calendar className="h-3 w-3" /> Timeline Omnicanal
                </h4>
                <div className="overflow-y-auto pr-2 custom-scrollbar space-y-4">
                    {events.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-10">Sin eventos registrados aún</p>
                    ) : (
                        events.map((event) => (
                            <div key={event.id} className="relative pl-6 border-l border-border pb-4 last:pb-0">
                                <div className={cn(
                                    "absolute -left-[5px] top-0 h-2.5 w-2.5 rounded-full border-2 border-card",
                                    event.status === 'SUCCESS' ? "bg-emerald-500" :
                                    event.status === 'FAILURE' ? "bg-rose-500" : "bg-amber-500"
                                )} />
                                <div className="bg-muted/30 hover:bg-muted/50 transition-all rounded-2xl p-4 border border-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {event.type === 'WHATSAPP' && <MessageSquare className="h-3 w-3 text-emerald-500" />}
                                            {event.type === 'CALL' && <PhoneCall className="h-3 w-3 text-blue-500" />}
                                            <span className="text-[10px] font-black uppercase text-card-foreground">{event.title}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-muted-foreground">{event.timestamp}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
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
