"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, ChevronDown, RotateCcw, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const DATE_PRESETS = [
    { label: "Hoy", value: "today" },
    { label: "Ayer", value: "yesterday" },
    { label: "Últimos 7 días", value: "7d" },
    { label: "Últimos 30 días", value: "30d" },
    { label: "Este mes", value: "this_month" },
    { label: "Este año", value: "this_year" },
    { label: "Todos", value: "all" },
];

export function FilterBar({ availableCampaigns = [] }: { availableCampaigns?: string[] }) {
    const router = useRouter();
    const pathname = usePathname() ?? "";
    const searchParams = useSearchParams() ?? new URLSearchParams();

    // Local states for inputs
    const [draftPreset, setDraftPreset] = useState(searchParams.get("preset") || "30d");
    const [draftFrom, setDraftFrom] = useState(searchParams.get("from") || "");
    const [draftTo, setDraftTo] = useState(searchParams.get("to") || "");
    const [search, setSearch] = useState(searchParams.get("q") || "");
    const [curso, setCurso] = useState(searchParams.get("curso") || "");
    const [pais, setPais] = useState(searchParams.get("pais") || "");
    const [origen, setOrigen] = useState(searchParams.get("origen") || "");
    const [campana, setCampana] = useState(searchParams.get("campana") || "");

    const [isExpanded, setIsExpanded] = useState(false);

    function applyFilters() {
        const params = new URLSearchParams(searchParams.toString());

        if (draftPreset) params.set("preset", draftPreset);
        else params.delete("preset");

        if (draftFrom) params.set("from", draftFrom);
        else params.delete("from");

        if (draftTo) params.set("to", draftTo);
        else params.delete("to");

        if (search) params.set("q", search);
        else params.delete("q");

        if (curso) params.set("curso", curso);
        else params.delete("curso");

        if (pais) params.set("pais", pais);
        else params.delete("pais");

        if (origen) params.set("origen", origen);
        else params.delete("origen");

        if (campana) params.set("campana", campana);
        else params.delete("campana");

        params.set("page", "1"); // Reset pagination

        router.push(`${pathname}?${params.toString()}`);
    }

    function clearFilters() {
        setDraftPreset("30d");
        setDraftFrom("");
        setDraftTo("");
        setSearch("");
        setCurso("");
        setPais("");
        setOrigen("");
        setCampana("");
        router.push(pathname);
    }

    return (
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 md:p-5 shadow-sm transition-colors">
            {/* Row 1: Quick Presets */}
            <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1 custom-scrollbar no-scrollbar">
                {DATE_PRESETS.map((p) => (
                    <button
                        key={p.value}
                        onClick={() => {
                            setDraftPreset(p.value);
                            setDraftFrom("");
                            setDraftTo("");
                        }}
                        className={cn(
                            "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex-shrink-0",
                            draftPreset === p.value
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
                        )}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Row 2: Search + actions */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar teléfono / ID..."
                        title="Buscar teléfono o ID de lead"
                        aria-label="Buscar teléfono o ID de lead"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                        className="w-full rounded-xl border border-border bg-muted py-2.5 pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground transition-all outline-none focus:border-primary focus:bg-card"
                    />
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition-all flex-shrink-0",
                        isExpanded ? "border-primary/20 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                    )}
                >
                    <Filter className="h-4 w-4" />
                    <span className="hidden sm:inline">Filtros</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                </button>
                <button
                    onClick={applyFilters}
                    className="rounded-xl bg-primary px-4 sm:px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 flex-shrink-0"
                >
                    Aplicar
                </button>
            </div>

            {/* Row 2: Advanced filters (Colapsible) */}
            {isExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 pt-5 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Custom Dates - Takes 2 columns on larger screens */}
                    <div className="flex flex-col space-y-1.5 sm:col-span-2 lg:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Rango Personalizado</label>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="date"
                                    title="Fecha desde"
                                    aria-label="Fecha desde"
                                    value={draftFrom}
                                    onChange={(e) => { setDraftFrom(e.target.value); setDraftPreset(""); }}
                                    className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-xs font-bold text-foreground outline-none focus:border-primary focus:bg-card transition-all shadow-sm"
                                />
                            </div>
                            <span className="text-muted-foreground/30 font-bold">/</span>
                            <div className="relative flex-1">
                                <input
                                    type="date"
                                    title="Fecha hasta"
                                    aria-label="Fecha hasta"
                                    value={draftTo}
                                    onChange={(e) => { setDraftTo(e.target.value); setDraftPreset(""); }}
                                    className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-xs font-bold text-foreground outline-none focus:border-primary focus:bg-card transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Curso */}
                    <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Curso / Master</label>
                        <input
                            type="text"
                            placeholder="Ej: MBA..."
                            value={curso}
                            onChange={(e) => setCurso(e.target.value)}
                            className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:bg-card transition-all placeholder:text-muted-foreground shadow-sm"
                        />
                    </div>

                    {/* País */}
                    <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">País</label>
                        <input
                            type="text"
                            placeholder="Ej: España..."
                            value={pais}
                            onChange={(e) => setPais(e.target.value)}
                            className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:bg-card transition-all placeholder:text-muted-foreground shadow-sm"
                        />
                    </div>

                    {/* Origen */}
                    <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Origen</label>
                        <input
                            type="text"
                            placeholder="Ej: Facebook..."
                            value={origen}
                            onChange={(e) => setOrigen(e.target.value)}
                            className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:bg-card transition-all placeholder:text-muted-foreground shadow-sm"
                        />
                    </div>

                    {/* Campaña */}
                    <div className="flex flex-col justify-between space-y-1.5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Campaña</label>
                            {availableCampaigns.length > 0 ? (
                                <select
                                    value={campana}
                                    title="Seleccionar campaña"
                                    aria-label="Seleccionar campaña"
                                    onChange={(e) => setCampana(e.target.value)}
                                    className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:bg-card transition-all shadow-sm cursor-pointer appearance-none"
                                >
                                    <option value="">Todas las campañas</option>
                                    {availableCampaigns.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    placeholder="Ej: Invierno 2024..."
                                    value={campana}
                                    onChange={(e) => setCampana(e.target.value)}
                                    className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:bg-card transition-all placeholder:text-muted-foreground shadow-sm"
                                />
                            )}
                        </div>
                        <button
                            onClick={clearFilters}
                            className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-red-500 transition-colors mt-2"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Limpiar Filtros
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
