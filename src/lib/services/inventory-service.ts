import { getAdminSupabaseClient } from "@/lib/supabase/server";
import {
  MenuProductsRepository,
  IngredientsRepository,
  StockMovementsRepository,
} from "@/lib/repositories/inventory-repository";
import { MenuProduct, Ingredient, StockMovement } from "@/types/pedidos";

export interface StockCheckResult {
  isAvailable: boolean;
  unavailableItems: {
    name: string;
    reason: string;
    alternatives?: MenuProduct[];
  }[];
}

export interface DeductStockResult {
  success: boolean;
  deductedMovementsCount: number;
  warnings: {
    ingredientId: string;
    name: string;
    stockCurrent: number;
    stockMin: number;
    status: "bajo" | "agotado";
  }[];
  error?: string;
}

export class InventoryService {
  private static menuRepo = new MenuProductsRepository();
  private static ingRepo = new IngredientsRepository();
  private static movRepo = new StockMovementsRepository();

  /**
   * Obtiene la carta completa con estado de stock calculado en tiempo real
   */
  static async getMenu(
    tenantId: string,
    filters?: { category?: string; search?: string; isActive?: boolean }
  ): Promise<MenuProduct[]> {
    const res = await this.menuRepo.findByTenant(tenantId, filters);
    return res.data;
  }

  /**
   * Obtiene los insumos e ingredientes con sus alertas
   */
  static async getIngredients(tenantId: string): Promise<Ingredient[]> {
    const res = await this.ingRepo.findByTenant(tenantId);
    return res.data;
  }

  /**
   * Obtiene el historial de movimientos de stock
   */
  static async getMovements(
    tenantId: string,
    filters?: { ingredientId?: string; movementType?: string; limit?: number }
  ): Promise<StockMovement[]> {
    const res = await this.movRepo.findByTenant(tenantId, filters);
    return res.data;
  }

  /**
   * Alertas de insumos en nivel bajo o agotado
   */
  static async getLowStockAlerts(tenantId: string): Promise<Ingredient[]> {
    const ingredients = await this.getIngredients(tenantId);
    return ingredients.filter((i) => i.stockStatus === "bajo" || i.stockStatus === "agotado");
  }

  /**
   * Obtiene alternativas disponibles de la misma categoría cuando un producto está agotado
   */
  static async getAlternatives(tenantId: string, productIdOrName: string): Promise<MenuProduct[]> {
    const allProducts = await this.getMenu(tenantId, { isActive: true });
    const target = allProducts.find(
      (p) =>
        p.id === productIdOrName ||
        p.name.toLowerCase().trim() === productIdOrName.toLowerCase().trim()
    );

    if (!target) return [];

    return allProducts.filter(
      (p) => p.id !== target.id && p.category === target.category && p.stockStatus !== "agotado"
    );
  }

  /**
   * Valida disponibilidad de una lista de productos antes de confirmar pedido
   */
  static async checkProductAvailability(
    tenantId: string,
    items: { productId?: string; id?: string; name?: string; quantity: number }[]
  ): Promise<StockCheckResult> {
    const menu = await this.getMenu(tenantId);
    const unavailableItems: StockCheckResult["unavailableItems"] = [];

    for (const item of items) {
      const match = menu.find(
        (m) =>
          m.id === item.productId ||
          m.id === item.id ||
          (item.name && m.name.toLowerCase().trim() === item.name.toLowerCase().trim())
      );

      if (match && match.stockStatus === "agotado") {
        const alternatives = await this.getAlternatives(tenantId, match.id);
        unavailableItems.push({
          name: match.name,
          reason: "Producto temporalmente agotado por falta de insumos",
          alternatives,
        });
      }
    }

    return {
      isAvailable: unavailableItems.length === 0,
      unavailableItems,
    };
  }

  /**
   * Descuenta stock de ingredientes según la receta BOM de cada ítem al marcar el pedido como "servido".
   * Utiliza la función atómica RPC de PostgreSQL en Supabase.
   * Incluye fallback de deducción en TypeScript para robustez ante cualquier entorno.
   */
  static async deductStockOnServed(
    tenantId: string,
    reservationId?: string,
    orderId?: string,
    items: { productId?: string; id?: string; name?: string; quantity: number }[] = []
  ): Promise<DeductStockResult> {
    if (!items || items.length === 0) {
      return { success: true, deductedMovementsCount: 0, warnings: [] };
    }

    try {
      const supabase = await getAdminSupabaseClient();

      // Formatear items para el RPC
      const rpcItems = items.map((i) => ({
        productId: i.productId || i.id,
        name: i.name,
        quantity: i.quantity || 1,
      }));

      // Intentar llamar a la función atómica PostgreSQL
      const rpcResult = await (
        supabase as unknown as {
          rpc: (
            fn: string,
            params: Record<string, unknown>
          ) => Promise<{ data: unknown; error: { message: string } | null }>;
        }
      ).rpc("deduct_stock_for_order", {
        p_tenant_id: tenantId,
        p_items: rpcItems,
        p_reservation_id: reservationId || null,
        p_order_id: orderId || null,
      });
      const { data, error } = rpcResult;

      if (!error && data) {
        const resultObj = data as {
          success?: boolean;
          deducted_movements_count?: number;
          warnings?: Array<{
            ingredient_id: string;
            name: string;
            stock_current: number;
            stock_min: number;
            status: "bajo" | "agotado";
          }>;
        };
        return {
          success: Boolean(resultObj.success),
          deductedMovementsCount: Number(resultObj.deducted_movements_count) || 0,
          warnings: (resultObj.warnings || []).map((w) => ({
            ingredientId: w.ingredient_id,
            name: w.name,
            stockCurrent: Number(w.stock_current),
            stockMin: Number(w.stock_min),
            status: w.status,
          })),
        };
      }

      console.warn(
        "[InventoryService] Supabase RPC deduct_stock_for_order falló o no existe aún, ejecutando fallback:",
        error?.message
      );

      // Fallback robusto en TS si el RPC aún no fue desplegado en la base
      return await this.fallbackDeductStock(tenantId, reservationId, orderId, rpcItems);
    } catch (e: unknown) {
      console.error("[InventoryService] Exception in deductStockOnServed:", e);
      return {
        success: false,
        deductedMovementsCount: 0,
        warnings: [],
        error: (e instanceof Error ? e.message : null) || "Error desconocido al descontar stock",
      };
    }
  }

  /**
   * Deducción en memoria/repositorio como fallback
   */
  private static async fallbackDeductStock(
    tenantId: string,
    reservationId?: string,
    orderId?: string,
    items: { productId?: string; name?: string; quantity: number }[] = []
  ): Promise<DeductStockResult> {
    const menu = await this.getMenu(tenantId);
    let count = 0;
    const warnings: DeductStockResult["warnings"] = [];

    for (const item of items) {
      const prod = menu.find(
        (m) =>
          m.id === item.productId ||
          (item.name && m.name.toLowerCase().trim() === item.name.toLowerCase().trim())
      );

      if (prod && prod.recipe && prod.recipe.length > 0) {
        const itemQty = item.quantity || 1;
        for (const rec of prod.recipe) {
          const deductQty = rec.quantity * itemQty;
          const updated = await this.ingRepo.adjustStock(
            tenantId,
            rec.ingredientId,
            "venta",
            deductQty,
            `Consumo servido (${prod.name} x${itemQty})`
          );

          count++;
          if (updated.data && updated.data.stockStatus !== "disponible") {
            warnings.push({
              ingredientId: updated.data.id,
              name: updated.data.name,
              stockCurrent: updated.data.stockCurrent,
              stockMin: updated.data.stockMin,
              status: updated.data.stockStatus as "bajo" | "agotado",
            });
          }
        }
      }
    }

    return {
      success: true,
      deductedMovementsCount: count,
      warnings,
    };
  }

  /**
   * Genera el contexto de la carta para el System Prompt de la IA de WhatsApp
   */
  static async getMenuContextForIA(tenantId: string): Promise<string> {
    try {
      const menu = await this.getMenu(tenantId, { isActive: true });
      if (menu.length === 0) {
        return "Actualmente la carta no tiene platos registrados en el sistema.";
      }

      const lines: string[] = [
        "--- CARTA Y DISPONIBILIDAD EN TIEMPO REAL (Fudo POS) ---",
        "INSTRUCCIÓN PARA LA IA: Ofrece solo platos con stock disponible. Si el cliente pide un plato agotado, sugiérele cordialmente las alternativas disponibles indicadas.",
        "",
      ];

      const categories = ["entrante", "principal", "postre", "bebida", "especial"] as const;

      for (const cat of categories) {
        const prods = menu.filter((p) => p.category === cat);
        if (prods.length === 0) continue;

        lines.push(`[${cat.toUpperCase()}]`);
        for (const p of prods) {
          const priceFormatted = `$${p.price.toLocaleString("es-CL")}`;
          let statusText = "🟢 Disponible";
          if (p.stockStatus === "bajo") {
            statusText = "🟡 Últimas unidades disponibles";
          } else if (p.stockStatus === "agotado") {
            statusText = "🔴 AGOTADO (No ofrecer - sugerir otro plato de la categoría)";
          }

          const desc = p.description ? ` - ${p.description}` : "";
          const allergens =
            p.allergens && p.allergens.length > 0 ? ` (Alérgenos: ${p.allergens.join(", ")})` : "";

          lines.push(`• ${p.name}: ${priceFormatted} | Estado: ${statusText}${desc}${allergens}`);
        }
        lines.push("");
      }

      return lines.join("\n");
    } catch (e) {
      console.error("[InventoryService] Error generating menu for IA:", e);
      return "Carta disponible sujeta a confirmación de stock.";
    }
  }
}
