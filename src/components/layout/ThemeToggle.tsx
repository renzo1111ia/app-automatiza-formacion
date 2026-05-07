"use client";

import { Moon, Sun, Droplets, Leaf, Rocket, Monitor } from "lucide-react";
import { useTheme, Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, ElementType } from "react";

const THEMES: { id: Theme; name: string; icon: ElementType; color: string }[] = [
    { id: "light", name: "Día", icon: Sun, color: "bg-amber-400" },
    { id: "dark", name: "Noche", icon: Moon, color: "bg-slate-700" },
    { id: "aqua", name: "Aqua", icon: Droplets, color: "bg-cyan-400" },
    { id: "esmeralda", name: "Esmeralda", icon: Leaf, color: "bg-emerald-500" },
    { id: "space", name: "Espacio", icon: Rocket, color: "bg-indigo-600" },
    { id: "system", name: "Sistema", icon: Monitor, color: "bg-slate-400" },
];

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const activeTheme = THEMES.find(t => t.id === theme) || THEMES[0];

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "group relative flex items-center gap-2 px-3 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all hover:border-primary/40 shadow-sm",
                    isOpen && "ring-2 ring-primary/20"
                )}
                title="Cambiar tema visual"
                aria-label="Abrir selector de temas"
            >
                <div className={cn("h-4 w-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold", activeTheme.color)}>
                    <activeTheme.icon className="h-2.5 w-2.5" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">
                    Tema: {activeTheme.name}
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 space-y-1">
                        {THEMES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => {
                                    setTheme(t.id);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                                    theme === t.id 
                                        ? "bg-primary/10 text-primary" 
                                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                                )}
                                title={`Seleccionar tema ${t.name}`}
                            >
                                <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center text-white", t.color)}>
                                    <t.icon className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-widest">{t.name}</span>
                                {theme === t.id && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
