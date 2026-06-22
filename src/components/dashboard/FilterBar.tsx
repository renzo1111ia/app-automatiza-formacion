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
    <div className="border-border bg-card mb-6 flex flex-col gap-3 rounded-3xl border p-4 shadow-sm transition-colors md:p-5">
      {/* Row 1: Quick Presets */}
      <div className="border-border bg-muted custom-scrollbar no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl border p-1">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              setDraftPreset(p.value);
              setDraftFrom("");
              setDraftTo("");
            }}
            className={cn(
              "flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all",
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
          <Search className="text-muted-foreground absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar teléfono / ID..."
            title="Buscar teléfono o ID de lead"
            aria-label="Buscar teléfono o ID de lead"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm font-medium transition-all outline-none"
          />
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex flex-shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition-all",
            isExpanded
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
        </button>
        <button
          onClick={applyFilters}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition-all sm:px-6"
        >
          Aplicar
        </button>
      </div>

      {/* Row 2: Advanced filters (Colapsible) */}
      {isExpanded && (
        <div className="border-border animate-in fade-in slide-in-from-top-2 grid grid-cols-1 gap-x-6 gap-y-4 border-t pt-5 duration-200 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {/* Custom Dates - Takes 2 columns on larger screens */}
          <div className="flex flex-col space-y-1.5 sm:col-span-2 lg:col-span-2">
            <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-wider uppercase">
              Rango Personalizado
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="date"
                  title="Fecha desde"
                  aria-label="Fecha desde"
                  value={draftFrom}
                  onChange={(e) => {
                    setDraftFrom(e.target.value);
                    setDraftPreset("");
                  }}
                  className="border-border bg-muted text-foreground focus:border-primary focus:bg-card w-full rounded-xl border px-3 py-2.5 text-xs font-bold shadow-sm transition-all outline-none"
                />
              </div>
              <span className="text-muted-foreground/30 font-bold">/</span>
              <div className="relative flex-1">
                <input
                  type="date"
                  title="Fecha hasta"
                  aria-label="Fecha hasta"
                  value={draftTo}
                  onChange={(e) => {
                    setDraftTo(e.target.value);
                    setDraftPreset("");
                  }}
                  className="border-border bg-muted text-foreground focus:border-primary focus:bg-card w-full rounded-xl border px-3 py-2.5 text-xs font-bold shadow-sm transition-all outline-none"
                />
              </div>
            </div>
          </div>

          {/* Curso */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-wider uppercase">
              Curso / Master
            </label>
            <input
              type="text"
              placeholder="Ej: MBA..."
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              className="border-border bg-muted text-foreground focus:border-primary focus:bg-card placeholder:text-muted-foreground w-full rounded-xl border px-3 py-2.5 text-sm font-medium shadow-sm transition-all outline-none"
            />
          </div>

          {/* País */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-wider uppercase">
              País
            </label>
            <input
              type="text"
              placeholder="Ej: España..."
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              className="border-border bg-muted text-foreground focus:border-primary focus:bg-card placeholder:text-muted-foreground w-full rounded-xl border px-3 py-2.5 text-sm font-medium shadow-sm transition-all outline-none"
            />
          </div>

          {/* Origen */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-wider uppercase">
              Origen
            </label>
            <input
              type="text"
              placeholder="Ej: Facebook..."
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              className="border-border bg-muted text-foreground focus:border-primary focus:bg-card placeholder:text-muted-foreground w-full rounded-xl border px-3 py-2.5 text-sm font-medium shadow-sm transition-all outline-none"
            />
          </div>

          {/* Campaña */}
          <div className="flex flex-col justify-between space-y-1.5">
            <div className="space-y-1.5">
              <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-wider uppercase">
                Campaña
              </label>
              {availableCampaigns.length > 0 ? (
                <select
                  value={campana}
                  title="Seleccionar campaña"
                  aria-label="Seleccionar campaña"
                  onChange={(e) => setCampana(e.target.value)}
                  className="border-border bg-muted text-foreground focus:border-primary focus:bg-card w-full cursor-pointer appearance-none rounded-xl border px-3 py-2.5 text-sm font-medium shadow-sm transition-all outline-none"
                >
                  <option value="">Todas las campañas</option>
                  {availableCampaigns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Ej: Invierno 2024..."
                  value={campana}
                  onChange={(e) => setCampana(e.target.value)}
                  className="border-border bg-muted text-foreground focus:border-primary focus:bg-card placeholder:text-muted-foreground w-full rounded-xl border px-3 py-2.5 text-sm font-medium shadow-sm transition-all outline-none"
                />
              )}
            </div>
            <button
              onClick={clearFilters}
              className="text-muted-foreground mt-2 flex items-center justify-center gap-2 text-[9px] font-black tracking-[0.2em] uppercase transition-colors hover:text-red-500"
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
