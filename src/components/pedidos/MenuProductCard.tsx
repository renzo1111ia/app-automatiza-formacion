"use client";

import React from "react";
import { MenuProduct } from "@/types/pedidos";
import { formatCLP } from "@/lib/mock-pedidos-data";
import {
  Clock,
  Layers,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Utensils,
} from "lucide-react";

interface MenuProductCardProps {
  product: MenuProduct;
  onEdit: (product: MenuProduct) => void;
  onDelete: (id: string) => void;
  onToggleActive: (product: MenuProduct) => void;
  imageUrl?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  entrante: "Entrante",
  principal: "Plato Principal",
  postre: "Postre",
  bebida: "Bebida",
  especial: "Especial del Chef",
};

export const MenuProductCard: React.FC<MenuProductCardProps> = ({
  product,
  onEdit,
  onDelete,
  onToggleActive,
  imageUrl,
}) => {
  const stockBadge = () => {
    switch (product.stockStatus) {
      case "agotado":
        return (
          <span className="flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-400">
            <XCircle className="h-3 w-3" /> Agotado
          </span>
        );
      case "bajo":
        return (
          <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300">
            <AlertCircle className="h-3 w-3" /> Stock Bajo
          </span>
        );
      case "disponible":
      default:
        return (
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Disponible
          </span>
        );
    }
  };

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 ${
        product.isActive
          ? "border-slate-800 bg-slate-950/80 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10"
          : "border-slate-900 bg-slate-950/40 opacity-60"
      }`}
    >
      {/* Top Media / Thumbnail Bar */}
      <div className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-slate-900">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-700">
            <Utensils className="mb-1 h-10 w-10 opacity-50" />
            <span className="text-[11px] font-semibold tracking-wider uppercase">Sin imagen</span>
          </div>
        )}

        {/* Floating Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">{stockBadge()}</div>

        <div className="absolute top-2.5 right-2.5">
          <span className="rounded-md border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300 backdrop-blur-md">
            {CATEGORY_LABELS[product.category] || product.category}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between space-y-3 p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-base font-bold text-white transition-colors group-hover:text-indigo-300">
              {product.name}
            </h3>
            <span className="flex-shrink-0 text-base font-extrabold text-emerald-400">
              {formatCLP(product.price)}
            </span>
          </div>

          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
              {product.description}
            </p>
          )}
        </div>

        {/* Metadata pills (time, recipe ingredients, allergens) */}
        <div className="space-y-1.5 border-t border-slate-800/60 pt-1 text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-500" /> {product.preparationTime || 15} min prep.
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3 text-indigo-400" />
              {product.recipe && product.recipe.length > 0
                ? `${product.recipe.length} insumo${product.recipe.length > 1 ? "s" : ""}`
                : "Sin receta (stock directo)"}
            </span>
          </div>

          {product.allergens && product.allergens.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {product.allergens.map((alg, idx) => (
                <span
                  key={idx}
                  className="py-0.2 rounded border border-amber-500/20 bg-amber-500/10 px-1.5 text-[10px] text-amber-400/90"
                >
                  {alg}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-900/60 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={product.isActive}
            onChange={() => onToggleActive(product)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0"
          />
          <span>{product.isActive ? "Activo" : "Inactivo"}</span>
        </label>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(product)}
            className="rounded-lg bg-slate-800 p-1.5 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            title="Editar plato y receta"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="rounded-lg bg-slate-800 p-1.5 text-slate-400 transition-colors hover:bg-rose-900/40 hover:text-rose-400"
            title="Eliminar plato"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
