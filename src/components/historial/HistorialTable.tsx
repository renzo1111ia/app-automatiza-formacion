"use client";

import { useState, useCallback, useTransition, useEffect, useRef, useMemo } from "react";
import { fetchCalls, type FetchCallsResult } from "@/lib/actions/calls";
import { DuplicateLeadDialog } from "@/components/historial/DuplicateLeadDialog";
// import { AudioPlayer } from "@/components/historial/AudioPlayer";
import { LeadTraceabilitySidebar, TraceabilityEvent } from "@/components/historial/LeadTraceability";
import { fetchLeadEvents } from "@/lib/actions/lead-events";
import { cn } from "@/lib/utils";
import type { HistorialRow } from "@/types/database";
import { 
  Search, 
  RotateCcw, 
  User, 
  Target, 
  MapPin, 
  Clock
} from 'lucide-react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

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

const DATE_PRESETS = [
    { label: "Hoy", value: "today" },
    { label: "Ayer", value: "yesterday" },
    { label: "Últ. 7 días", value: "7d" },
    { label: "Últ. 30 días", value: "30d" },
    { label: "Este mes", value: "this_month" },
    { label: "Todos", value: "all" },
];

interface Props {
    initialData: FetchCallsResult;
    fromDate: string;
    toDate: string;
    columns?: { key: string; label: string }[];
}

export function HistorialTable({ initialData, fromDate, toDate, columns }: Props) {
    const [result, setResult] = useState<FetchCallsResult>(initialData);
    const [page, setPage] = useState(1);
    
    const activeColumns = useMemo(() => {
        if (columns && columns.length > 0) return columns;
        if (result.data.length > 0) {
            const firstRow = result.data[0];
            const ignoredKeys = ["id", "id_lead", "llamadas", "total_llamadas", "url_grabacion", "transcripcion", "resumen"];
            return Object.keys(firstRow)
                .filter(key => !ignoredKeys.includes(key))
                .map(key => ({
                    key,
                    label: key.replace(/_/g, " ").toUpperCase()
                }));
        }
        return [];
    }, [columns, result.data]);

    const [draftSearch, setDraftSearch] = useState("");
    const [draftStatus, setDraftStatus] = useState("ALL");
    const [draftPreset, setDraftPreset] = useState("all");
    const [draftFrom, setDraftFrom] = useState(fromDate.slice(0, 10));
    const [draftTo, setDraftTo] = useState(toDate.slice(0, 10));
    const [draftPais, setDraftPais] = useState("");
    const [draftOrigen, setDraftOrigen] = useState("");
    const [draftCampana, setDraftCampana] = useState("");
    const [draftTipoLead, setDraftTipoLead] = useState("");
    const [draftCual, setDraftCual] = useState("");

    const [activeSearch, setActiveSearch] = useState("");
    const [activeStatus, setActiveStatus] = useState("ALL");
    const [activeFrom, setActiveFrom] = useState(fromDate);
    const [activeTo, setActiveTo] = useState(toDate);
    const [activePais, setActivePais] = useState("");
    const [activeOrigen, setActiveOrigen] = useState("");
    const [activeCampana, setActiveCampana] = useState("");
    const [activeTipoLead, setActiveTipoLead] = useState("");
    const [activeCual, setActiveCual] = useState("");

    const [dupPhone, setDupPhone] = useState<string | null>(null);
    const [popoverRow, setPopoverRow] = useState<HistorialRow | null>(null);
    const [leadEvents, setLeadEvents] = useState<TraceabilityEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const topScrollRef = useRef<HTMLDivElement>(null);
    const isScrolling = useRef(false);

    const onScrollTable = useCallback(() => {
        if (!isScrolling.current && tableContainerRef.current && topScrollRef.current) {
            isScrolling.current = true;
            topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
            setTimeout(() => { isScrolling.current = false; }, 0);
        }
    }, []);

    const onScrollTop = useCallback(() => {
        if (!isScrolling.current && tableContainerRef.current && topScrollRef.current) {
            isScrolling.current = true;
            tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
            setTimeout(() => { isScrolling.current = false; }, 0);
        }
    }, []);

    const [isPending, startTransition] = useTransition();
    const [tableScrollWidth, setTableScrollWidth] = useState(0);

    useEffect(() => {
        if (tableContainerRef.current) {
            setTableScrollWidth(tableContainerRef.current.scrollWidth);
            const observer = new ResizeObserver(() => {
                if (tableContainerRef.current) {
                    setTableScrollWidth(tableContainerRef.current.scrollWidth);
                }
            });
            observer.observe(tableContainerRef.current);
            return () => observer.disconnect();
        }
    }, [result.data]);

    useEffect(() => {
        if (popoverRow) {
            // Loading is now triggered by the click handler to avoid cascading renders
            fetchLeadEvents(popoverRow.id).then(evs => {
                setLeadEvents(evs);
                setLoadingEvents(false);
            });
        }
    }, [popoverRow]);

    const closePopover = () => {
        setPopoverRow(null);
        setLeadEvents([]);
        setLoadingEvents(false);
    };

    const load = useCallback((
        p: number, search: string, status: string,
        fDate: string, tDate: string,
        pais?: string, origen?: string, campana?: string,
        tipoLead?: string, cualificacion?: string,
    ) => {
        startTransition(async () => {
            const res = await fetchCalls({
                page: p, pageSize: PAGE_SIZE,
                search, estadoLlamada: status,
                fromDate: fDate, toDate: tDate,
                pais, origen, campana, tipoLead, cualificacion,
            });
            setResult(res);
        });
    }, []);

    function applyFilters() {
        const now = new Date();
        const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let fDate: string, tDate: string;

        if (draftPreset === "today") { fDate = sod.toISOString(); tDate = now.toISOString(); }
        else if (draftPreset === "yesterday") { const y = new Date(sod.getTime() - 864e5); fDate = y.toISOString(); tDate = now.toISOString(); }
        else if (draftPreset === "7d") { fDate = new Date(now.getTime() - 7 * 864e5).toISOString(); tDate = now.toISOString(); }
        else if (draftPreset === "30d") { fDate = new Date(now.getTime() - 30 * 864e5).toISOString(); tDate = now.toISOString(); }
        else if (draftPreset === "this_month") { fDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); tDate = now.toISOString(); }
        else if (draftPreset === "all") { fDate = new Date(2000, 0, 1).toISOString(); tDate = now.toISOString(); }
        else {
            fDate = draftFrom ? new Date(draftFrom).toISOString() : new Date(2000, 0, 1).toISOString();
            tDate = draftTo ? new Date(draftTo + "T23:59:59.999Z").toISOString() : now.toISOString();
        }

        setActiveSearch(draftSearch); setActiveStatus(draftStatus);
        setActiveFrom(fDate); setActiveTo(tDate);
        setActivePais(draftPais); setActiveOrigen(draftOrigen);
        setActiveCampana(draftCampana); setActiveTipoLead(draftTipoLead);
        setActiveCual(draftCual);
        setPage(1);
        load(1, draftSearch, draftStatus, fDate, tDate, draftPais, draftOrigen, draftCampana, draftTipoLead, draftCual);
    }

    function resetFilters() {
        setDraftSearch(""); setDraftStatus("ALL"); setDraftPreset("all");
        setDraftFrom(""); setDraftTo(""); setDraftPais("");
        setDraftOrigen(""); setDraftCampana(""); setDraftTipoLead(""); setDraftCual("");
        setActiveSearch(""); setActiveStatus("ALL");
        setActivePais(""); setActiveOrigen(""); setActiveCampana("");
        setActiveTipoLead(""); setActiveCual("");
        const now = new Date().toISOString();
        const past = new Date(2000, 0, 1).toISOString();
        setActiveFrom(past); setActiveTo(now);
        setPage(1);
        load(1, "", "ALL", past, now);
    }

    function handlePage(p: number) {
        setPage(p);
        load(p, activeSearch, activeStatus, activeFrom, activeTo, activePais, activeOrigen, activeCampana, activeTipoLead, activeCual);
    }

    return (
        <>
            <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
                        {DATE_PRESETS.map((pr) => (
                            <button key={pr.value} onClick={() => setDraftPreset(pr.value)}
                                className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                                    draftPreset === pr.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
                                )}>
                                {pr.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="relative col-span-2">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input type="text" placeholder="Buscar por teléfono, nombre..."
                            value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                            className="w-full rounded-xl border border-border bg-muted/30 py-2.5 pl-10 pr-4 text-sm font-medium text-card-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10"
                        />
                    </div>
                    <select title="Estado" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}
                        className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm font-bold outline-none focus:border-primary">
                        <option value="ALL">Todo</option>
                        {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-sm font-black text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                        {result.count.toLocaleString()} resultados
                    </span>
                    <div className="flex gap-3">
                        <button onClick={resetFilters} className="text-sm font-bold text-muted-foreground flex items-center gap-2 hover:text-foreground">
                            <RotateCcw className="h-4 w-4" /> Limpiar
                        </button>
                        <button onClick={applyFilters} disabled={isPending}
                            className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50">
                            {isPending ? "..." : "Aplicar"}
                        </button>
                    </div>
                </div>
            </div>

            {popoverRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md px-4 py-10"
                    onClick={closePopover}>
                    <div className="max-w-4xl w-full max-h-full overflow-hidden flex flex-col rounded-[2.5rem] border border-border bg-card shadow-2xl animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}>
                        
                        <div className="flex items-center justify-between p-8 border-b border-border bg-muted/30">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground">
                                    <User className="h-8 w-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-card-foreground">{popoverRow.nombre} {popoverRow.apellido}</h3>
                                    <span className="font-mono text-sm font-bold text-primary">{popoverRow.telefono}</span>
                                </div>
                            </div>
                            <button onClick={closePopover} className="h-12 w-12 rounded-2xl bg-card border border-border text-muted-foreground hover:text-destructive">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
                            <section className="bg-slate-50 dark:bg-slate-900/40 rounded-[2.5rem] p-8 border border-slate-100 dark:border-white/5 shadow-inner">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-2">
                                    <User className="h-3 w-3" /> Información del Lead
                                </h4>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                                    <DetailItem label="Programa" value={popoverRow.programa_nombre} icon={<Target className="h-3.5 w-3.5" />} />
                                    <DetailItem label="País" value={popoverRow.pais} icon={<MapPin className="h-3.5 w-3.5" />} />
                                    <DetailItem label="Cualidad" value={popoverRow.cualificacion} />
                                    <DetailItem label="Intento actual" value={popoverRow.intentos_count} />
                                </div>
                            </section>

                            <section className="pt-6">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
                                    <Clock className="h-3 w-3" /> Estado de Trazabilidad Gestión v2.0
                                </h4>
                                {loadingEvents ? (
                                    <div className="flex items-center justify-center py-20 animate-pulse text-muted-foreground text-xs font-bold">
                                        Analizando interacciones omnicanal...
                                    </div>
                                ) : (
                                    <LeadTraceabilitySidebar 
                                        currentStage={popoverRow.current_stage || 'QUALIFICATION'}
                                        events={leadEvents}
                                        leadMetadata={popoverRow.metadata || {}}
                                    />
                                )}
                            </section>
                        </div>

                        <div className="p-6 border-t border-border bg-muted/30 flex justify-end">
                            <button onClick={closePopover} className="px-8 py-3 rounded-2xl bg-card border border-border text-sm font-black text-muted-foreground hover:bg-muted transition-all">
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div 
                ref={topScrollRef}
                onScroll={onScrollTop}
                className="overflow-x-auto h-5 mb-2 sticky top-[100px] z-[20] custom-scrollbar"
            >
                <div className={cn("h-[1px]", tableScrollWidth ? `[width:${tableScrollWidth}px]` : "w-full")} />
            </div>

            <div 
                ref={tableContainerRef}
                onScroll={onScrollTable}
                className="overflow-x-auto rounded-[2.5rem] border border-border bg-card shadow-xl overflow-hidden"
            >
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/50">
                            {activeColumns.map((col) => (
                                <th key={col.key} className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className={cn("divide-y divide-border", isPending && "opacity-50")}>
                        {result.data.length === 0 ? (
                            <tr>
                                <td colSpan={activeColumns.length} className="py-24 text-center text-muted-foreground font-bold">No se encontraron registros</td>
                            </tr>
                        ) : (
                            result.data.map((row) => (
                                <tr 
                                    key={row.id} 
                                    className="group hover:bg-primary/5 transition-all cursor-pointer" 
                                    onClick={() => {
                                        setLoadingEvents(true);
                                        setPopoverRow(row);
                                    }}
                                >
                                    {activeColumns.map((col) => (
                                        <td key={col.key} className="px-6 py-5 whitespace-nowrap">
                                            {renderCell(row, col.key)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {result.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span className="bg-muted px-3 py-1 rounded-lg">Pág. {page} de {result.totalPages}</span>
                    <div className="flex gap-2">
                        <button onClick={() => handlePage(page - 1)} disabled={page === 1} className="px-4 py-2 bg-card border border-border rounded-xl">←</button>
                        <button onClick={() => handlePage(page + 1)} disabled={page === result.totalPages} className="px-4 py-2 bg-card border border-border rounded-xl">→</button>
                    </div>
                </div>
            )}

            {dupPhone && <DuplicateLeadDialog phone={dupPhone} onClose={() => setDupPhone(null)} />}
        </>
    );
}

function renderCell(row: HistorialRow, key: string) {
    switch (key) {
        case "lead":
            return (
                <div className="flex flex-col">
                    <span className="font-black text-card-foreground text-sm tracking-tight">{row.nombre} {row.apellido}</span>
                    <span className="font-mono text-[11px] font-bold text-primary">{row.telefono}</span>
                </div>
            );
        default:
            const val = row[key];
            if (val === null || val === undefined) return <span className="text-muted-foreground/30">—</span>;
            return <span className="text-xs font-medium text-card-foreground">{String(val)}</span>;
    }
}

function DetailItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number | null | undefined; }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{icon} {label}</span>
            <span className="text-xs font-semibold text-card-foreground">{value ?? "—"}</span>
        </div>
    );
}
