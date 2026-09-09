"use client";

import React, { useState } from "react";
import { Ingredient, StockUnit, StockMovementType } from "@/types/pedidos";
import { formatCLP } from "@/lib/mock-pedidos-data";
import {
  Search,
  Plus,
  PackagePlus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Check,
  X,
} from "lucide-react";

interface IngredientsTableProps {
  ingredients: Ingredient[];
  onCreateIngredient: (input: {
    name: string;
    unit: StockUnit;
    stockCurrent: number;
    stockMin: number;
    costPerUnit: number;
  }) => Promise<void>;
  onUpdateIngredient: (id: string, updates: Partial<Ingredient>) => Promise<void>;
  onAdjustStock: (
    id: string,
    movementType: StockMovementType,
    quantity: number,
    reason: string
  ) => Promise<void>;
  onDeleteIngredient: (id: string) => Promise<void>;
}

export const IngredientsTable: React.FC<IngredientsTableProps> = ({
  ingredients,
  onCreateIngredient,
  onUpdateIngredient,
  onAdjustStock,
  onDeleteIngredient,
}) => {
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [adjustModalIng, setAdjustModalIng] = useState<Ingredient | null>(null);

  // Form states para crear/editar
  const [formName, setFormName] = useState("");
  const [formUnit, setFormUnit] = useState<StockUnit>("unidad");
  const [formStockCurrent, setFormStockCurrent] = useState<number>(0);
  const [formStockMin, setFormStockMin] = useState<number>(5);
  const [formCostPerUnit, setFormCostPerUnit] = useState<number>(0);

  // Form state para reposición/ajuste
  const [adjustType, setAdjustType] = useState<StockMovementType>("reposicion");
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustReason, setAdjustReason] = useState<string>("Compra / Ingreso de proveedor");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline stock editing states
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineStockVal, setInlineStockVal] = useState<number>(0);

  const openCreateModal = () => {
    setEditingIngredient(null);
    setFormName("");
    setFormUnit("unidad");
    setFormStockCurrent(0);
    setFormStockMin(5);
    setFormCostPerUnit(0);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (ing: Ingredient) => {
    setEditingIngredient(ing);
    setFormName(ing.name);
    setFormUnit(ing.unit);
    setFormStockCurrent(ing.stockCurrent);
    setFormStockMin(ing.stockMin);
    setFormCostPerUnit(ing.costPerUnit);
    setIsCreateModalOpen(true);
  };

  const openAdjustModal = (ing: Ingredient) => {
    setAdjustModalIng(ing);
    setAdjustType("reposicion");
    setAdjustQty(10);
    setAdjustReason("Compra de insumos / reposición de proveedor");
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingIngredient) {
        await onUpdateIngredient(editingIngredient.id, {
          name: formName.trim(),
          unit: formUnit,
          stockCurrent: Number(formStockCurrent),
          stockMin: Number(formStockMin),
          costPerUnit: Number(formCostPerUnit),
        });
      } else {
        await onCreateIngredient({
          name: formName.trim(),
          unit: formUnit,
          stockCurrent: Number(formStockCurrent),
          stockMin: Number(formStockMin),
          costPerUnit: Number(formCostPerUnit),
        });
      }
      setIsCreateModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalIng) return;
    setIsSubmitting(true);
    try {
      await onAdjustStock(adjustModalIng.id, adjustType, Number(adjustQty), adjustReason.trim());
      setAdjustModalIng(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveInlineStock = async (ing: Ingredient) => {
    const diff = Number(inlineStockVal) - ing.stockCurrent;
    if (diff !== 0) {
      await onAdjustStock(
        ing.id,
        "ajuste_manual",
        diff,
        `Conteo físico / ajuste rápido (${diff > 0 ? "+" : ""}${diff} ${ing.unit})`
      );
    }
    setInlineEditingId(null);
  };

  const filteredIngredients = ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar insumo o ingrediente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pr-4 pl-10 text-xs text-white transition-colors focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Nuevo Insumo
        </button>
      </div>

      {/* Table Card */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/90 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3">Insumo</th>
                <th className="px-3 py-3">Unidad</th>
                <th className="px-4 py-3">Stock Actual</th>
                <th className="px-3 py-3">Stock Mínimo</th>
                <th className="px-3 py-3">Costo Unitario</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredIngredients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No se encontraron insumos. Agrega el primer ingrediente con &quot;Nuevo
                    Insumo&quot;.
                  </td>
                </tr>
              ) : (
                filteredIngredients.map((ing) => (
                  <tr key={ing.id} className="group transition-colors hover:bg-slate-900/40">
                    <td className="px-4 py-3.5 font-semibold text-white">{ing.name}</td>
                    <td className="px-3 py-3.5 font-mono text-slate-400">{ing.unit}</td>

                    {/* Stock Actual with inline quick edit */}
                    <td className="px-4 py-3.5">
                      {inlineEditingId === ing.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={inlineStockVal}
                            onChange={(e) => setInlineStockVal(Number(e.target.value))}
                            className="w-20 rounded border border-indigo-500 bg-slate-900 px-2 py-1 text-xs font-bold text-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveInlineStock(ing)}
                            className="rounded bg-emerald-600 p-1 text-white hover:bg-emerald-500"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setInlineEditingId(null)}
                            className="rounded bg-slate-800 p-1 text-slate-400 hover:bg-slate-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-sm font-extrabold ${
                              ing.stockStatus === "agotado"
                                ? "text-rose-400"
                                : ing.stockStatus === "bajo"
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                            }`}
                          >
                            {ing.stockCurrent}
                          </span>
                          <button
                            onClick={() => {
                              setInlineEditingId(ing.id);
                              setInlineStockVal(ing.stockCurrent);
                            }}
                            className="p-1 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-slate-300"
                            title="Ajuste rápido de conteo físico"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3.5 font-mono text-slate-400">
                      {ing.stockMin} {ing.unit}
                    </td>

                    <td className="px-3 py-3.5 font-semibold text-slate-300">
                      {formatCLP(ing.costPerUnit)}
                    </td>

                    {/* Badge Estado */}
                    <td className="px-3 py-3.5">
                      {ing.stockStatus === "agotado" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-400">
                          <XCircle className="h-3 w-3" /> Agotado
                        </span>
                      ) : ing.stockStatus === "bajo" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                          <AlertTriangle className="h-3 w-3" /> Bajo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Normal
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openAdjustModal(ing)}
                          className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                          title="Reponer o ajustar stock"
                        >
                          <PackagePlus className="h-3.5 w-3.5" /> Reponer
                        </button>

                        <button
                          onClick={() => openEditModal(ing)}
                          className="rounded-lg bg-slate-800 p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                          title="Editar insumo"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => onDeleteIngredient(ing.id)}
                          className="rounded-lg bg-slate-800 p-1.5 text-slate-500 transition-colors hover:bg-rose-950/40 hover:text-rose-400"
                          title="Eliminar insumo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Crear / Editar Insumo */}
      {isCreateModalOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingIngredient ? "Editar Insumo" : "Nuevo Insumo / Ingrediente"}
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Nombre *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Carne Molida Vacuno, Queso Cheddar..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Unidad de Medida
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as StockUnit)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="unidad">Unidad (un)</option>
                    <option value="kg">Kilogramo (kg)</option>
                    <option value="gr">Gramo (gr)</option>
                    <option value="lt">Litro (lt)</option>
                    <option value="ml">Mililitro (ml)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Stock Actual
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formStockCurrent}
                    onChange={(e) => setFormStockCurrent(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Stock Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formStockMin}
                    onChange={(e) => setFormStockMin(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Costo Unitario ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formCostPerUnit}
                    onChange={(e) => setFormCostPerUnit(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                >
                  {isSubmitting ? "Guardando..." : "Guardar Insumo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reposición / Ajuste de Stock */}
      {adjustModalIng && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Registrar Movimiento de Stock</h3>
                <p className="text-xs text-slate-400">
                  {adjustModalIng.name} (Actual: {adjustModalIng.stockCurrent} {adjustModalIng.unit}
                  )
                </p>
              </div>
              <button
                onClick={() => setAdjustModalIng(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Tipo de Movimiento
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as StockMovementType)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="reposicion">Reposición / Compra (+ Suma)</option>
                  <option value="merma">Merma / Desperdicio (- Resta)</option>
                  <option value="ajuste_manual">Ajuste Manual / Corrección</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Cantidad ({adjustModalIng.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Motivo / Proveedor *
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ej. Factura 1248 Proveedor Carnes del Sur..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setAdjustModalIng(null)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  {isSubmitting ? "Registrando..." : "Confirmar Movimiento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
