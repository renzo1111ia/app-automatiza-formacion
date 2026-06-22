"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  Mic2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Voice {
  id: string;
  name: string;
  provider: string;
  gender: string;
  accent: string;
  preview_url?: string;
}

interface VoicesCatalogProps {
  voices: Voice[];
  selectedVoiceId: string;
  onAssign: (voiceId: string) => void;
  onSync: () => void;
  isSyncing: boolean;
}

// Animated waveform bars — pure CSS animation staggered by index
function WaveformBars({ isPlaying, color = "pink" }: { isPlaying: boolean; color?: string }) {
  const bars = Array.from({ length: 12 });
  const colorMap: Record<string, string> = {
    pink: "bg-pink-400",
    blue: "bg-blue-400",
    purple: "bg-purple-400",
    emerald: "bg-emerald-400",
  };
  const cls = colorMap[color] || "bg-pink-400";

  return (
    <div className="flex items-center gap-[2px]" aria-hidden>
      {bars.map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-[2px] rounded-full transition-all duration-75",
            cls,
            isPlaying ? "opacity-90" : "opacity-20"
          )}
          style={{
            height: isPlaying
              ? `${8 + Math.sin((i / bars.length) * Math.PI * 2) * 6 + (i % 3) * 2}px`
              : "4px",
            animationDelay: `${i * 40}ms`,
            animation: isPlaying
              ? `wave-bar 0.6s ease-in-out ${i * 0.05}s infinite alternate`
              : "none",
          }}
        />
      ))}
      <style>{`
        @keyframes wave-bar {
          0% { height: 4px; opacity: 0.4; }
          100% { height: 20px; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Individual voice card
function VoiceCard({
  voice,
  isSelected,
  onAssign,
}: {
  voice: Voice;
  isSelected: boolean;
  onAssign: (id: string) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const isMale = voice.gender === "male";

  const updateProgress = useCallback(function updateProgressFn() {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 1;
    setProgress((cur / dur) * 100);
    if (!audioRef.current.paused) {
      rafRef.current = requestAnimationFrame(updateProgressFn);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!voice.preview_url) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(voice.preview_url);
      audioRef.current.addEventListener("loadedmetadata", () => {
        setDuration(audioRef.current?.duration || 0);
      });
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false);
        setProgress(0);
        cancelAnimationFrame(rafRef.current);
      });
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300",
        isSelected
          ? "via-card to-card border-pink-500/30 bg-gradient-to-br from-pink-500/10 shadow-lg shadow-pink-500/10"
          : "border-border bg-card hover:border-border/80 hover:shadow-md hover:shadow-black/10"
      )}
    >
      {/* Top accent gradient */}
      <div
        className={cn(
          "h-0.5 w-full transition-all duration-300",
          isMale
            ? "bg-gradient-to-r from-blue-500/60 via-indigo-400/40 to-transparent"
            : "bg-gradient-to-r from-pink-500/60 via-rose-400/40 to-transparent"
        )}
      />

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              {/* Gender icon */}
              <div
                className={cn(
                  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg",
                  isMale ? "bg-blue-500/10" : "bg-pink-500/10"
                )}
              >
                <User className={cn("h-3 w-3", isMale ? "text-blue-400" : "text-pink-400")} />
              </div>
              <h4 className="text-foreground truncate text-sm leading-none font-bold">
                {voice.name}
              </h4>
              {isSelected && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-pink-500" />}
            </div>
            <p className="text-muted-foreground/50 truncate font-mono text-[9px]">{voice.id}</p>
          </div>
          {/* Provider badge */}
          <span className="border-border bg-muted text-muted-foreground flex-shrink-0 rounded-full border px-2 py-0.5 text-[7px] font-black tracking-widest uppercase">
            {voice.provider}
          </span>
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-lg px-2 py-0.5 text-[8px] font-black tracking-widest uppercase",
              isMale
                ? "bg-blue-500/10 text-blue-500 dark:text-blue-400"
                : "bg-pink-500/10 text-pink-600 dark:text-pink-400"
            )}
          >
            {isMale ? "♂ Hombre" : "♀ Mujer"}
          </span>
          <span className="border-border bg-muted/60 text-muted-foreground rounded-lg border px-2 py-0.5 text-[8px] font-black tracking-widest uppercase">
            {voice.accent}
          </span>
        </div>

        {/* Audio player */}
        {voice.preview_url ? (
          <div className="space-y-2">
            {/* Waveform + play button row */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                title={isPlaying ? "Pausar" : "Escuchar preview"}
                className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all",
                  isPlaying
                    ? "bg-pink-500 shadow-lg shadow-pink-500/30 hover:bg-pink-600"
                    : "border-border bg-muted hover:bg-accent border"
                )}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5 text-white" />
                ) : (
                  <Play className="text-foreground h-3.5 w-3.5" />
                )}
              </button>

              <div className="flex-1">
                <WaveformBars isPlaying={isPlaying} color={isMale ? "blue" : "pink"} />
              </div>

              {duration > 0 && (
                <span className="text-muted-foreground/60 flex-shrink-0 font-mono text-[8px]">
                  {formatTime(duration)}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="bg-border h-0.5 w-full overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-100",
                  isMale ? "bg-blue-400" : "bg-pink-400"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="border-border flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed">
            <Mic2 className="text-muted-foreground/30 h-3.5 w-3.5" />
            <span className="text-muted-foreground/30 text-[8px] font-black tracking-widest uppercase">
              Sin preview disponible
            </span>
          </div>
        )}
      </div>

      {/* Footer: Assign button */}
      <div className="border-border border-t px-5 py-3">
        {isSelected ? (
          <div className="flex items-center justify-center gap-1.5 text-[9px] font-black tracking-widest text-pink-500 uppercase">
            <CheckCircle2 className="h-3 w-3" />
            Voz del Agente Activo
          </div>
        ) : (
          <button
            onClick={() => onAssign(voice.id)}
            className="border-border bg-muted text-muted-foreground w-full rounded-xl border py-2 text-[9px] font-black tracking-widest uppercase transition-all hover:border-pink-500/20 hover:bg-pink-500/10 hover:text-pink-500"
          >
            Asignar al Agente
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Main catalog component
export function VoicesCatalog({
  voices,
  selectedVoiceId,
  onAssign,
  onSync,
  isSyncing,
}: VoicesCatalogProps) {
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState<"all" | "male" | "female">("all");
  const [filterAccent, setFilterAccent] = useState("all");

  const accents = Array.from(new Set(voices.map((v) => v.accent)))
    .filter(Boolean)
    .sort();

  const filtered = voices.filter((v) => {
    const q = search.toLowerCase();

    // Búsqueda en texto libre (segura contra valores null/undefined)
    const matchSearch =
      !q ||
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.accent && v.accent.toLowerCase().includes(q)) ||
      (v.id && v.id.toLowerCase().includes(q)) ||
      (v.provider && v.provider.toLowerCase().includes(q)) ||
      (v.gender && v.gender.toLowerCase().includes(q));

    const matchGender = filterGender === "all" || v.gender === filterGender;
    const matchAccent = filterAccent === "all" || v.accent === filterAccent;

    return matchSearch && matchGender && matchAccent;
  });

  return (
    <motion.div
      key="voces"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex h-full flex-col gap-5"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-pink-500/20 bg-pink-500/10">
            <Volume2 className="h-4 w-4 text-pink-400" />
          </div>
          <div>
            <h3 className="text-foreground text-sm font-black tracking-tight">Catálogo de Voces</h3>
            <p className="text-muted-foreground text-[10px]">
              {filtered.length} de {voices.length} voces disponibles
            </p>
          </div>
        </div>
        <button
          onClick={onSync}
          disabled={isSyncing}
          title="Sincronizar voces desde Retell"
          className="border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 rounded-xl border px-3 py-2 text-[9px] font-black tracking-widest uppercase transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
          {isSyncing ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-40 flex-1">
          <Search className="text-muted-foreground/50 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, acento o ID..."
            title="Buscar voz"
            className="border-border bg-card text-foreground placeholder-muted-foreground/50 h-9 w-full rounded-xl border pr-3 pl-9 text-[11px] focus:ring-2 focus:ring-pink-500/10 focus:outline-none"
          />
        </div>

        {/* Gender filter */}
        <div className="border-border bg-card flex items-center gap-1 rounded-xl border p-1">
          {(["all", "female", "male"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setFilterGender(g)}
              title={g === "all" ? "Todos" : g === "female" ? "Mujer" : "Hombre"}
              className={cn(
                "rounded-lg px-3 py-1 text-[9px] font-black tracking-widest uppercase transition-all",
                filterGender === g
                  ? g === "female"
                    ? "bg-pink-500 text-white shadow-sm shadow-pink-500/20"
                    : g === "male"
                      ? "bg-blue-500 text-white shadow-sm shadow-blue-500/20"
                      : "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {g === "all" ? "Todos" : g === "female" ? "♀ Mujer" : "♂ Hombre"}
            </button>
          ))}
        </div>

        {/* Accent filter */}
        {accents.length > 0 && (
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="text-muted-foreground/50 h-3.5 w-3.5" />
            <select
              value={filterAccent}
              onChange={(e) => setFilterAccent(e.target.value)}
              title="Filtrar por acento"
              className="border-border bg-card text-foreground h-9 rounded-xl border px-3 text-[10px] font-medium focus:ring-2 focus:ring-pink-500/10 focus:outline-none"
            >
              <option value="all">Todos los acentos</option>
              {accents.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      {voices.length === 0 ? (
        <div className="border-border flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/5">
            <Volume2 className="h-8 w-8 text-pink-400/40" />
          </div>
          <div className="text-center">
            <p className="text-foreground text-sm font-black">Sin voces sincronizadas</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Haz clic en &quot;Sincronizar&quot; para cargar el catálogo de voces desde Retell.
            </p>
          </div>
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-xl bg-pink-600 px-5 py-2.5 text-[10px] font-black tracking-widest text-white uppercase shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Voces"}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-border flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-12 text-center">
          <Search className="text-muted-foreground/30 h-6 w-6" />
          <p className="text-foreground text-sm font-bold">Sin resultados</p>
          <p className="text-muted-foreground text-xs">
            Prueba con otros filtros o términos de búsqueda.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setFilterGender("all");
              setFilterAccent("all");
            }}
            className="border-border text-muted-foreground hover:bg-accent mt-2 rounded-lg border px-3 py-1.5 text-[9px] font-black tracking-widest uppercase"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 overflow-y-auto pb-8 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                isSelected={selectedVoiceId === voice.id}
                onAssign={onAssign}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
