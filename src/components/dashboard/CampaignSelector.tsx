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
      <label className="mb-2 ml-1 block text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase">
        Selección de Campaña
      </label>
      <div className="flex items-center gap-3">
        <div className="relative inline-block text-left">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="group flex min-w-[300px] items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-6 py-4 shadow-sm transition-all hover:border-blue-500/30 hover:shadow-md"
          >
            <div className="rounded-xl bg-blue-50 p-2 transition-colors group-hover:bg-blue-100">
              <Layers className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="mb-1 text-[10px] leading-none font-black tracking-widest text-slate-400 uppercase">
                {currentCampaign ? "Campaña Activa" : "Viendo Todas"}
              </p>
              <p className="truncate text-sm font-black text-slate-900">
                {currentCampaign || "Todas las Campañas"}
              </p>
            </div>
            <ChevronDown
              className={cn("h-5 w-5 text-slate-400 transition-transform", isOpen && "rotate-180")}
            />
          </button>

          {isOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
              <div className="animate-in zoom-in-95 custom-scrollbar absolute left-0 z-40 mt-3 max-h-[400px] w-full overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-2 shadow-2xl duration-200">
                <button
                  onClick={() => selectCampaign("")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all",
                    !currentCampaign
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  Todas las Campañas
                  {!currentCampaign && <Check className="h-4 w-4" />}
                </button>
                <div className="mx-2 my-2 h-px bg-slate-100" />
                {campaigns.map((c) => (
                  <button
                    key={c}
                    onClick={() => selectCampaign(c)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold transition-all",
                      currentCampaign === c
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-50"
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
          <div className="no-scrollbar hidden items-center gap-2 overflow-x-auto py-1 lg:flex">
            <span className="px-2 text-[10px] font-bold tracking-widest text-slate-300 uppercase">
              Sugeridas:
            </span>
            {campaigns.slice(0, 3).map((c) => (
              <button
                key={`chip-${c}`}
                onClick={() => selectCampaign(c)}
                className="rounded-full border border-transparent bg-slate-100 px-4 py-2 text-[10px] font-black tracking-widest whitespace-nowrap text-slate-600 uppercase transition-all hover:border-blue-500/20 hover:bg-blue-50 hover:text-blue-600"
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
