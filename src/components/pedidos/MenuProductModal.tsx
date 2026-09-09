"use client";

import React, { useState, useEffect } from "react";
import { MenuProduct, Ingredient, MenuCategory } from "@/types/pedidos";
import {
  X,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Image as ImageIcon,
  Utensils,
  DollarSign,
  Clock,
} from "lucide-react";
import { formatCLP } from "@/lib/mock-pedidos-data";

interface KnowledgeItemSimple {
  id: string;
  name: string;
  file_url: string | null;
}

interface MenuProductModalProps {
  product?: MenuProduct | null;
  availableIngredients: Ingredient[];
  knowledgeItems: KnowledgeItemSimple[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    name: string;
    description?: string;
    category: MenuCategory;
    price: number;
    isActive: boolean;
    preparationTime: number;
    allergens: string[];
    imageKnowledgeBaseId?: string | null;
    recipe: { ingredientId: string; quantity: number }[];
  }) => Promise<void>;
}

const COMMON_ALLERGENS = [
  "Gluten",
  "Lácteos",
  "Frutos Secos",
  "Huevo",
  "Mariscos",
  "Soya",
  "Pescado",
  "Maní",
];

export const MenuProductModal: React.FC<MenuProductModalProps> = ({
  product,
  availableIngredients,
  knowledgeItems,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<MenuCategory>("principal");
  const [price, setPrice] = useState<number>(0);
  const [preparationTime, setPreparationTime] = useState<number>(15);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [selectedKbImageId, setSelectedKbImageId] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<{ ingredientId: string; quantity: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setDescription(product.description || "");
      setCategory(product.category || "principal");
      setPrice(product.price || 0);
      setPreparationTime(product.preparationTime || 15);
      setAllergens(product.allergens || []);
      setSelectedKbImageId(product.imageKnowledgeBaseId || null);
      setRecipe(
        (product.recipe || []).map((r) => ({
          ingredientId: r.ingredientId,
          quantity: r.quantity,
        }))
      );
    } else {
      setName("");
      setDescription("");
      setCategory("principal");
      setPrice(0);
      setPreparationTime(15);
      setAllergens([]);
      setSelectedKbImageId(null);
      setRecipe([]);
    }
    setErrorMsg(null);
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleAddRecipeRow = () => {
    if (availableIngredients.length === 0) return;
    // Seleccionar el primer ingrediente no usado aún en la receta
    const unused = availableIngredients.find((i) => !recipe.some((r) => r.ingredientId === i.id));
    const ingId = unused ? unused.id : availableIngredients[0].id;
    setRecipe([...recipe, { ingredientId: ingId, quantity: 1 }]);
  };

  const handleUpdateRecipeRow = (
    index: number,
    field: "ingredientId" | "quantity",
    value: string | number
  ) => {
    const updated = [...recipe];
    updated[index] = { ...updated[index], [field]: value };
    setRecipe(updated);
  };

  const handleRemoveRecipeRow = (index: number) => {
    setRecipe(recipe.filter((_, idx) => idx !== index));
  };

  const toggleAllergen = (allergen: string) => {
    if (allergens.includes(allergen)) {
      setAllergens(allergens.filter((a) => a !== allergen));
    } else {
      setAllergens([...allergens, allergen]);
    }
  };

  // Calcular costo teórico total de la receta
  const estimatedCost = recipe.reduce((acc, r) => {
    const ing = availableIngredients.find((i) => i.id === r.ingredientId);
    if (!ing) return acc;
    return acc + ing.costPerUnit * (r.quantity || 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("El nombre del plato es obligatorio");
      return;
    }
    if (price < 0) {
      setErrorMsg("El precio no puede ser negativo");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSave({
        id: product?.id,
        name: name.trim(),
        description: description.trim(),
        category,
        price: Number(price),
        isActive: product ? product.isActive : true,
        preparationTime: Number(preparationTime) || 15,
        allergens,
        imageKnowledgeBaseId: selectedKbImageId,
        recipe,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar el plato";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm duration-200">
      <div className="relative my-8 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-600/20 text-indigo-400">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {product ? "Editar Plato de la Carta" : "Nuevo Plato en la Carta"}
              </h2>
              <p className="text-xs text-slate-400">
                Define receta de insumos (BOM) para descuento automático de stock tipo Fudo POS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto p-6">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
              {errorMsg}
            </div>
          )}

          {/* Basic Fields */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">Nombre del Plato *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Hamburguesa Clásica con Queso"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white transition-colors focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MenuCategory)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white transition-colors focus:border-indigo-500 focus:outline-none"
              >
                <option value="entrante">Entrante / Aperitivo</option>
                <option value="principal">Plato Principal</option>
                <option value="postre">Postre</option>
                <option value="bebida">Bebida / Cóctel</option>
                <option value="especial">Especial del Chef</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Precio de Venta ($ CLP) *
              </label>
              <div className="relative">
                <DollarSign className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pr-3.5 pl-9 text-sm font-semibold text-white transition-colors focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">
                Descripción para la Carta y la IA
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción apetitosa que el agente de WhatsApp leerá al recomendar este plato..."
                className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white transition-colors focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Tiempo de Preparación (min)
              </label>
              <div className="relative">
                <Clock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="number"
                  min="1"
                  value={preparationTime}
                  onChange={(e) => setPreparationTime(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pr-3.5 pl-9 text-sm text-white transition-colors focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Knowledge Base Image Selection */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-300">
                <ImageIcon className="h-3.5 w-3.5 text-indigo-400" /> Imagen (Knowledge Base)
              </label>
              <select
                value={selectedKbImageId || ""}
                onChange={(e) => setSelectedKbImageId(e.target.value || null)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white transition-colors focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Sin imagen asignada</option>
                {knowledgeItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Allergens selection */}
          <div className="space-y-2 border-t border-slate-800 pt-2">
            <label className="block text-xs font-semibold text-slate-300">
              Alérgenos e Indicaciones
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_ALLERGENS.map((allergen) => {
                const isSelected = allergens.includes(allergen);
                return (
                  <button
                    type="button"
                    key={allergen}
                    onClick={() => toggleAllergen(allergen)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {allergen}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recipe BOM (Bill of Materials) */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Sparkles className="h-4 w-4 text-indigo-400" /> Receta de Insumos (BOM Fudo)
                </h3>
                <p className="text-xs text-slate-400">
                  Especifica qué ingredientes y en qué cantidad se descuentan al servir este plato
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRecipeRow}
                disabled={availableIngredients.length === 0}
                className="flex items-center gap-1 rounded-xl border border-indigo-500/30 bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition-colors hover:bg-indigo-600/30 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar Insumo
              </button>
            </div>

            {availableIngredients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-4 text-center text-xs text-slate-400">
                Aún no tienes ingredientes registrados en la pestaña &quot;Ingredientes&quot;.
                Puedes guardar el plato ahora y asociarle insumos después.
              </div>
            ) : recipe.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-4 text-center text-xs text-slate-400">
                Este plato no tiene receta asignada. Si no agregas insumos, se tratará como producto
                de stock directo sin deducción de ingredientes.
              </div>
            ) : (
              <div className="space-y-2">
                {recipe.map((row, idx) => {
                  const currentIng = availableIngredients.find((i) => i.id === row.ingredientId);
                  const lineCost = currentIng ? currentIng.costPerUnit * (row.quantity || 0) : 0;

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs"
                    >
                      {/* Ingredient selector */}
                      <select
                        value={row.ingredientId}
                        onChange={(e) => handleUpdateRecipeRow(idx, "ingredientId", e.target.value)}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                      >
                        {availableIngredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit}) - Stock: {ing.stockCurrent}
                          </option>
                        ))}
                      </select>

                      {/* Quantity input */}
                      <div className="flex w-36 items-center gap-1">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={row.quantity}
                          onChange={(e) =>
                            handleUpdateRecipeRow(idx, "quantity", Number(e.target.value))
                          }
                          className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-right text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
                          placeholder="Cantidad"
                          required
                        />
                        <span className="truncate text-xs text-slate-400">
                          {currentIng?.unit || "unidad"}
                        </span>
                      </div>

                      {/* Line cost info */}
                      <span className="hidden w-24 text-right font-medium text-slate-400 sm:inline">
                        {formatCLP(lineCost)}
                      </span>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeRow(idx)}
                        className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-950/30 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}

                {/* Recipe Cost Summary */}
                <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/80 p-3 text-xs">
                  <span className="text-slate-400">Costo teórico de insumos por plato:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-amber-400">
                      {formatCLP(estimatedCost)}
                    </span>
                    {price > 0 && (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        Margen: {Math.max(0, Math.round(((price - estimatedCost) / price) * 100))}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isSubmitting ? "Guardando..." : product ? "Guardar Cambios" : "Crear Plato"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
