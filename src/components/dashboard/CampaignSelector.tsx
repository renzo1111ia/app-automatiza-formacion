"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Layers, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Props {
    campaigns: string[];
    currentCampaign?: string;
}

export function CampaignSelector({ campaigns, currentCampaign }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams() ?? new URLSearchParams();
    const [isOpen, setIsOpen] = useState(false);

    function selectCampaign(name: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (name) params.set("campana", name);
        else params.delete("campana");
        params.set("page", "1");
        router.push(`${pathname}?${params.toString()}`);
        setIsOpen(false);
    }

    return (
        <div className="relative mt-8">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1 mb-2 block">
                Selección de Campaña
            </label>
            <div className="flex items-center gap-3">
                <div className="relative inline-block text-left">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-3 px-6 py-4 bg-white border border-slate-200 rounded-[20px] shadow-sm hover:border-blue-500/30 hover:shadow-md transition-all group min-w-[300px]"
                    >
                        <div className="p-2 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                            <Layers className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">
                                {currentCampaign ? "Campaña Activa" : "Viendo Todas"}
                            </p>
                            <p className="text-sm font-black text-slate-900 truncate">
                                {currentCampaign || "Todas las Campañas"}
                            </p>
                        </div>
                        <ChevronDown className={cn("h-5 w-5 text-slate-400 transition-transform", isOpen && "rotate-180")} />
                    </button>

                    {isOpen && (
                        <>
                            <div 
                                className="fixed inset-0 z-30" 
                                onClick={() => setIsOpen(false)}
                            />
                            <div className="absolute left-0 mt-3 w-full bg-white border border-slate-200 rounded-[24px] shadow-2xl z-40 p-2 animate-in zoom-in-95 duration-200 max-h-[400px] overflow-y-auto custom-scrollbar">
                                <button
                                    onClick={() => selectCampaign("")}
                                    className={cn(
                                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all",
                                        !currentCampaign ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                                    )}
                                >
                                    Todas las Campañas
                                    {!currentCampaign && <Check className="h-4 w-4" />}
                                </button>
                                <div className="h-px bg-slate-100 my-2 mx-2" />
                                {campaigns.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => selectCampaign(c)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all text-left",
                                            currentCampaign === c ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="truncate">{c}</span>
                                        {currentCampaign === c && <Check className="h-4 w-4" />}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {!currentCampaign && campaigns.length > 0 && (
                    <div className="hidden lg:flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-2">Sugeridas:</span>
                        {campaigns.slice(0, 3).map(c => (
                            <button
                                key={`chip-${c}`}
                                onClick={() => selectCampaign(c)}
                                className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border border-transparent hover:border-blue-500/20"
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
