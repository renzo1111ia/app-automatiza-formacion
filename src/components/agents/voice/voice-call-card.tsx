"use client";

import React, { useState } from "react";
import { Phone, Clock, FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/actions/inbox";

interface VoiceCallCardProps {
  message: ChatMessage;
}

export function VoiceCallCard({ message }: VoiceCallCardProps) {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const metadata = message.metadata || {};

  const callId = metadata.call_id as string;
  const status = (metadata.estado_llamada as string) || "UNKNOWN";
  const durationSec = (metadata.duracion_segundos as number) || 0;
  const urlGrabacion = metadata.url_grabacion as string | null;
  const transcripcion = metadata.transcripcion as string | null;
  const resumen = metadata.resumen as string | null;
  const disconnectReason = metadata.razon_termino as string | null;

  const date = new Date(message.created_at);
  const formattedTime = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const formattedDate = date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${secs}s`;
  };

  // Resolve status badges
  const isCompleted = status.toLowerCase() === "completed" || status.toLowerCase() === "completada";
  const statusLabel = isCompleted ? "Completada" : status;

  return (
    <div className="my-6 flex justify-center">
      <div className="bg-card/45 border-border hover:border-primary/20 flex w-full max-w-xl flex-col rounded-3xl border p-6 shadow-xl transition-all duration-300 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-2xl border",
              isCompleted
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/20 bg-amber-500/10 text-amber-400"
            )}>
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <p className="text-foreground text-xs font-black tracking-widest uppercase">
                Llamada de Voz
              </p>
              <p className="text-muted-foreground/60 text-[10px] font-bold">
                ID: {callId ? callId.substring(0, 12) : "N/A"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "rounded-full px-3 py-0.5 text-[9px] font-black tracking-wider uppercase",
              isCompleted
                ? "bg-emerald-500/20 border border-emerald-500/25 text-emerald-400"
                : "bg-amber-500/20 border border-amber-500/25 text-amber-400"
            )}>
              {statusLabel}
            </div>
            <span className="text-muted-foreground/40 text-[10px] font-bold tabular-nums">
              {formattedDate}, {formattedTime}
            </span>
          </div>
        </div>

        {/* Audio Recording & Duration */}
        <div className="py-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1.5 font-bold tracking-wider uppercase text-[9px] text-muted-foreground/60">
              <Clock className="h-3 w-3" /> Duración
            </span>
            <span className="font-bold tabular-nums text-foreground/80">
              {formatDuration(durationSec)}
            </span>
          </div>

          {urlGrabacion ? (
            <div className="bg-background/40 border border-border/40 rounded-2xl p-3 shadow-inner">
              <audio controls className="w-full focus:outline-none" src={urlGrabacion} />
            </div>
          ) : (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive-foreground/80 flex items-center gap-2 rounded-2xl p-4 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span>Grabación no disponible (llamada perdida o sin registro de audio)</span>
            </div>
          )}

          {disconnectReason && (
            <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider mt-2.5 ml-1">
              Razón de término: <span className="text-muted-foreground/75 font-black">{disconnectReason}</span>
            </p>
          )}
        </div>

        {/* AI Summary */}
        {resumen && (
          <div className="bg-background/20 border border-border/30 rounded-2xl p-4 mb-4 text-xs">
            <div className="flex items-center gap-1.5 font-bold tracking-wider uppercase text-[9px] text-muted-foreground/60 mb-2">
              <CheckCircle className="h-3 w-3 text-primary/70" /> Resumen AI
            </div>
            <p className="text-muted-foreground leading-relaxed font-medium">
              {resumen}
            </p>
          </div>
        )}

        {/* Transcript (Collapsible Accordion) */}
        {transcripcion && (
          <div className="border border-border/35 rounded-2xl overflow-hidden transition-all duration-300">
            <button
              onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-background/20 hover:bg-background/40 transition-colors text-xs"
            >
              <span className="flex items-center gap-1.5 font-bold tracking-wider uppercase text-[9px] text-muted-foreground/60">
                <FileText className="h-3 w-3" /> Transcripción
              </span>
              {isTranscriptOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground/50" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
              )}
            </button>
            {isTranscriptOpen && (
              <div className="bg-background/10 border-t border-border/20 p-4 max-h-60 overflow-y-auto custom-scrollbar">
                <p className="text-muted-foreground/80 text-xs leading-relaxed font-medium whitespace-pre-wrap">
                  {transcripcion}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
