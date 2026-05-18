"use client";

import { useEffect, useState } from "react";
import { X, Phone, Clock, Calendar, PhoneCall, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { getCallsByPhone, fetchIntentosByPhone } from "@/lib/actions/calls";
import type { HistorialRow, IntentoLlamada } from "@/types/database";
import { formatDuration, formatDate, cn } from "@/lib/utils";
import { AudioPlayer } from "./AudioPlayer";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    CONTACTED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    NO_CONTACT: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    VOICEMAIL: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    TRANSFERRED_TO_HUMAN: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20",
    ANNULLED: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
    LATENCY_DROP: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",
    USER_INTERRUPTED: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    BUSY: "bg-muted text-muted-foreground border-border",
    INVALID_NUMBER: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

// ─── CALL CARD ────────────────────────────────────────────────────────────────

function CallCard({ call }: { call: HistorialRow }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="rounded-xl border border-border bg-muted/20 p-4 relative overflow-hidden group hover:border-primary/30 transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20 group-hover:bg-emerald-500/50 transition-colors" />

            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 mb-3 pl-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                    <PhoneCall className="h-3 w-3" /> Llamada
                </span>
                {call.estado_llamada && (
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        STATUS_COLORS[call.estado_llamada] ?? "bg-muted text-muted-foreground border-border")}>
                        {call.estado_llamada}
                    </span>
                )}
                {call.duracion_segundos != null && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        <Clock className="h-3 w-3" />
                        {formatDuration(call.duracion_segundos)}
                    </span>
                )}
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/60">
                    <Calendar className="h-3 w-3" />
                    {formatDate(call.fecha_inicio ?? null)}
                </span>
            </div>

            {/* Main fields */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs pl-2">
                {call.razon_termino && (
                    <div>
                        <span className="text-muted-foreground/50 block">Razón término</span>
                        <span className="text-card-foreground">{call.razon_termino}</span>
                    </div>
                )}
                {call.cualificacion && (
                    <div>
                        <span className="text-muted-foreground/50 block">Cualificación</span>
                        <span className={call.cualificacion === "SI" || call.cualificacion === "CUALIFICADO"
                            ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-card-foreground/80"}>
                            {call.cualificacion}
                        </span>
                    </div>
                )}
                {call.motivo_anulacion && (
                    <div className="col-span-2">
                        <span className="text-muted-foreground/50 block">Motivo anulación</span>
                        <span className="text-card-foreground">{call.motivo_anulacion}</span>
                    </div>
                )}
                {call.fecha_agendada_cliente && (
                    <div>
                        <span className="text-muted-foreground/50 block">Cita agendada</span>
                        <span className="text-teal-600 dark:text-teal-400 font-bold">{formatDate(call.fecha_agendada_cliente)}</span>
                    </div>
                )}
                {call.tipo_agente && (
                    <div>
                        <span className="text-muted-foreground/50 block">Tipo agente</span>
                        <span className="text-card-foreground/70">{call.tipo_agente}</span>
                    </div>
                )}
            </div>

            {/* Expand: resumen + audio */}
            {(call.resumen || call.url_grabacion) && (
                <>
                    <button onClick={() => setExpanded((v) => !v)}
                        className="mt-3 pl-2 flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-primary transition">
                        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {expanded ? "Ocultar detalle" : "Ver resumen / audio"}
                    </button>
                    {expanded && (
                        <div className="mt-3 pt-3 border-t border-border pl-2 space-y-3">
                            {call.resumen && (
                                <div>
                                    <span className="text-muted-foreground/40 text-xs block mb-1">Resumen</span>
                                    <p className="text-xs text-card-foreground/80 leading-relaxed whitespace-pre-wrap">{call.resumen}</p>
                                </div>
                            )}
                            {call.url_grabacion && <AudioPlayer src={call.url_grabacion} />}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── INTENTO CARD ─────────────────────────────────────────────────────────────

function IntentoCard({ intento }: { intento: IntentoLlamada }) {

    const fields: [string, string | number | null | undefined][] = [
        ["Tipo intento", intento.tipo_intento],
        ["Nº intento", intento.numero_intento],
        ["Estado", intento.estado],
        ["Fecha reintento", formatDate(intento.fecha_reintento ?? null)],
        ["Fecha ejecución", formatDate(intento.fecha_ejecucion ?? null)],
    ];

    return (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 relative overflow-hidden group hover:border-primary/40 transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/30 group-hover:bg-primary/60 transition-colors" />

            <div className="flex flex-wrap items-center gap-2 mb-3 pl-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5">
                    <RefreshCw className="h-3 w-3" /> Intento
                </span>
                {intento.tipo_intento && (
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                        {intento.tipo_intento}
                    </span>
                )}
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/40">
                    <Calendar className="h-3 w-3" />
                    {formatDate(intento.fecha_creacion ?? null)}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs pl-2">
                {fields.map(([label, val]) =>
                    val != null && val !== "" && val !== "—" ? (
                        <div key={label}>
                            <span className="text-muted-foreground/40 block">{label}</span>
                            <span className="text-card-foreground/90">{String(val)}</span>
                        </div>
                    ) : null
                )}
            </div>
        </div>
    );
}

// ─── DIALOG ───────────────────────────────────────────────────────────────────

interface Props {
    phone: string;
    onClose: () => void;
}

export function DuplicateLeadDialog({ phone, onClose }: Props) {
    const [calls, setCalls] = useState<HistorialRow[]>([]);
    const [intentos, setIntentos] = useState<IntentoLlamada[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        Promise.all([
            getCallsByPhone(phone).catch(() => [] as HistorialRow[]),
            fetchIntentosByPhone(phone).catch(() => [] as IntentoLlamada[]),
        ]).then(([callsData, intentosData]) => {
            if (mounted) {
                setCalls(callsData);
                setIntentos(intentosData);
                setLoading(false);
            }
        });
        return () => { mounted = false; };
    }, [phone]);

    // Unified timeline sorted by date desc
    type TimelineItem =
        | { kind: "call"; date: string; data: HistorialRow }
        | { kind: "intento"; date: string; data: IntentoLlamada };

    // Flattern calls from leads (consolidated objects)
    const flatCalls: TimelineItem[] = [];
    calls.forEach(lead => {
        lead.llamadas.forEach(ll => {
            flatCalls.push({
                kind: "call",
                date: ll.fecha_inicio ?? "",
                data: { ...lead, ...ll, llamadas: lead.llamadas } as HistorialRow
            });
        });
    });

    const timeline: TimelineItem[] = [
        ...flatCalls,
        ...intentos.map((i) => ({ kind: "intento" as const, date: i.fecha_creacion ?? "", data: i })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-background/80 backdrop-blur-sm sm:p-4">
            <div className="relative flex h-full w-full max-w-3xl flex-col bg-card sm:min-h-0 sm:rounded-2xl border border-border shadow-2xl animate-in slide-in-from-right overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Phone className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-card-foreground">Historial del número</h2>
                            <p className="text-xs text-primary font-mono mt-0.5">{phone}</p>
                        </div>
                    </div>
                    <button onClick={onClose} title="Cerrar" aria-label="Cerrar"
                        className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-card-foreground transition">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Summary badges */}
                {!loading && timeline.length > 0 && (
                    <div className="px-6 py-3 border-b border-border bg-muted/10 flex items-center gap-3 text-xs flex-wrap">
                        <span className="text-muted-foreground/60">{timeline.length} interacciones encontradas</span>
                        {calls.length > 0 && (
                            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                                <PhoneCall className="h-3 w-3" /> {calls.length} llamada{calls.length !== 1 && "s"}
                            </span>
                        )}
                        {intentos.length > 0 && (
                            <span className="flex items-center gap-1.5 text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5">
                                <RefreshCw className="h-3 w-3" /> {intentos.length} intento{intentos.length !== 1 && "s"}
                            </span>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    ) : timeline.length === 0 ? (
                        <div className="text-center text-muted-foreground/60 py-20">
                            No se encontraron registros para este número.
                        </div>
                    ) : (
                        timeline.map((item, idx) =>
                            item.kind === "call"
                                ? <CallCard key={`call-${item.data.id}`} call={item.data} />
                                : <IntentoCard key={`intento-${item.data.id ?? idx}`} intento={item.data} />
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
