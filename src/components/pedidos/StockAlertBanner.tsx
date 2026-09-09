"use client";

import React, { useState } from "react";
import { Ingredient } from "@/types/pedidos";
import { AlertTriangle, AlertOctagon, ChevronDown, ChevronUp, PackagePlus } from "lucide-react";

interface StockAlertBannerProps {
  lowStockItems: Ingredient[];
  onRestockClick?: (ingredient: Ingredient) => void;
}

export const StockAlertBanner: React.FC<StockAlertBannerProps> = ({
  lowStockItems,
  onRestockClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!lowStockItems || lowStockItems.length === 0) {
    return null;
  }

  const outOfStockCount = lowStockItems.filter((i) => i.stockStatus === "agotado").length;
  const lowCount = lowStockItems.filter((i) => i.stockStatus === "bajo").length;

  return (
    <div className="w-full rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-950/80 to-rose-950/30 p-4 shadow-lg backdrop-blur-md transition-all duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-400">
            {outOfStockCount > 0 ? (
              <AlertOctagon className="h-5 w-5 animate-pulse text-rose-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">
                Control de Stock: Alerta de Insumos Críticos
              </h4>
              {outOfStockCount > 0 && (
                <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-400">
                  {outOfStockCount} Agotado{outOfStockCount > 1 ? "s" : ""}
                </span>
              )}
              {lowCount > 0 && (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                  {lowCount} Stock Bajo
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Los platos asociados no se podrán ofrecer por la IA o mostrarán aviso de últimas
              unidades.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700"
        >
          {isExpanded ? "Ocultar detalle" : "Ver insumos afectados"}
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="animate-in fade-in mt-3 grid grid-cols-1 gap-2.5 border-t border-slate-800/80 pt-3 sm:grid-cols-2 md:grid-cols-3">
          {lowStockItems.map((ing) => (
            <div
              key={ing.id}
              className={`flex items-center justify-between rounded-xl border p-2.5 ${
                ing.stockStatus === "agotado"
                  ? "border-rose-800/40 bg-rose-950/30 text-rose-300"
                  : "border-amber-800/30 bg-amber-950/20 text-amber-300"
              }`}
            >
              <div className="mr-2 truncate">
                <span className="block truncate text-xs font-semibold text-white">{ing.name}</span>
                <span className="text-[11px] text-slate-400">
                  Stock:{" "}
                  <b className={ing.stockStatus === "agotado" ? "text-rose-400" : "text-amber-400"}>
                    {ing.stockCurrent}
                  </b>{" "}
                  {ing.unit} (Mín: {ing.stockMin})
                </span>
              </div>
              {onRestockClick && (
                <button
                  onClick={() => onRestockClick(ing)}
                  className="flex flex-shrink-0 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                >
                  <PackagePlus className="h-3 w-3 text-emerald-400" /> Reponer
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
