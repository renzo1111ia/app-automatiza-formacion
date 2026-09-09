import { getAdminSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type RepoResult, type RepoListResult, handleSupabaseError } from "./_base-repository";
import {
  MenuProduct,
  Ingredient,
  RecipeItem,
  StockMovement,
  StockStatus,
  StockMovementType,
  MenuCategory,
  StockUnit,
} from "@/types/pedidos";
import {
  CreateMenuProductInput,
  UpdateMenuProductInput,
  CreateIngredientInput,
  UpdateIngredientInput,
} from "@/lib/schemas/inventory";

// ---------- Local row-shape types (Supabase responses) ----------
interface IngredientRow {
  id: string;
  name: string;
  unit: string;
  stock_current: number;
  stock_min: number;
}

interface ProductRecipeRow {
  id: string;
  ingredient_id: string;
  quantity: number;
  ingredients: IngredientRow | null;
}

interface MenuProductRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  is_active: boolean;
  preparation_time: number | null;
  allergens: string[] | null;
  image_knowledge_base_id: string | null;
  created_at: string;
  updated_at: string;
  product_recipes: ProductRecipeRow[] | null;
}

interface IngredientDbRow {
  id: string;
  tenant_id: string;
  name: string;
  unit: string;
  stock_current: number;
  stock_min: number;
  cost_per_unit: number | null;
  created_at: string;
  updated_at: string;
}

interface StockMovementRow {
  id: string;
  tenant_id: string;
  ingredient_id: string;
  movement_type: string;
  quantity: number;
  reason: string | null;
  order_id: string | null;
  reservation_id: string | null;
  created_at: string;
  ingredients: { name: string } | null;
}

/**
 * Helper: returns admin Supabase client cast to an untyped SupabaseClient.
 * This is needed because our new tables (menu_products, ingredients, etc.)
 * were added via migration but `supabase gen types typescript` hasn't been
 * run yet, so the generated Database type doesn't include them.
 * All query results are manually cast to the typed interfaces defined above.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function db(): Promise<SupabaseClient<any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await getAdminSupabaseClient()) as unknown as SupabaseClient<any>;
}

// Helper para calcular estado de stock de un ingrediente
export function computeIngredientStockStatus(current: number, min: number): StockStatus {
  if (current <= 0) return "agotado";
  if (current <= min) return "bajo";
  return "disponible";
}

// -------------------------------------------------------------
// MENU PRODUCTS REPOSITORY
// -------------------------------------------------------------

export interface MenuProductFilters {
  category?: string;
  search?: string;
  isActive?: boolean;
}

export class MenuProductsRepository {
  async findByTenant(
    tenantId: string,
    filters?: MenuProductFilters
  ): Promise<RepoListResult<MenuProduct>> {
    try {
      const supabase = await db();
      let query = supabase
        .from("menu_products")
        .select(
          `
          id,
          tenant_id,
          name,
          description,
          category,
          price,
          is_active,
          preparation_time,
          allergens,
          image_knowledge_base_id,
          created_at,
          updated_at,
          product_recipes (
            id,
            ingredient_id,
            quantity,
            ingredients (
              id,
              name,
              unit,
              stock_current,
              stock_min
            )
          )
        `
        )
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      if (filters?.category && filters.category !== "all") {
        query = query.eq("category", filters.category);
      }
      if (filters?.isActive !== undefined) {
        query = query.eq("is_active", filters.isActive);
      }
      if (filters?.search) {
        query = query.ilike("name", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) return { data: [], error: handleSupabaseError(error) };

      const rows = (data || []) as unknown as MenuProductRow[];
      const products: MenuProduct[] = rows.map((row: MenuProductRow) => {
        const recipes: RecipeItem[] = (row.product_recipes || []).map((pr: ProductRecipeRow) => {
          const ing = pr.ingredients;
          return {
            id: pr.id,
            ingredientId: pr.ingredient_id,
            ingredientName: ing?.name || "Ingrediente",
            quantity: Number(pr.quantity) || 0,
            unit: (ing?.unit as StockUnit) || "unidad",
          };
        });

        // Calcular stockStatus general del producto en función de sus ingredientes
        let stockStatus: StockStatus = "disponible";
        if (recipes.length > 0) {
          let hasWarning = false;
          let hasAgotado = false;

          for (const pr of row.product_recipes || []) {
            const ing = pr.ingredients;
            if (!ing) continue;
            const current = Number(ing.stock_current) || 0;
            const min = Number(ing.stock_min) || 0;
            const req = Number(pr.quantity) || 0;

            if (current < req || current <= 0) {
              hasAgotado = true;
              break;
            } else if (current <= min) {
              hasWarning = true;
            }
          }

          if (hasAgotado) {
            stockStatus = "agotado";
          } else if (hasWarning) {
            stockStatus = "bajo";
          }
        }

        return {
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          description: row.description || "",
          category: row.category as MenuCategory,
          price: Number(row.price) || 0,
          isActive: Boolean(row.is_active),
          preparationTime: row.preparation_time || 15,
          allergens: row.allergens || [],
          imageKnowledgeBaseId: row.image_knowledge_base_id || undefined,
          recipe: recipes,
          stockStatus,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      return { data: products, error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findById(id: string, tenantId: string): Promise<RepoResult<MenuProduct>> {
    try {
      const res = await this.findByTenant(tenantId);
      if (res.error) return { data: null, error: res.error };
      const found = res.data.find((p) => p.id === id);
      return { data: found || null, error: found ? null : "Producto no encontrado" };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async create(tenantId: string, input: CreateMenuProductInput): Promise<RepoResult<MenuProduct>> {
    try {
      const supabase = await db();
      const { recipe, ...productData } = input;

      const { data: newProd, error } = await supabase
        .from("menu_products")
        .insert({
          tenant_id: tenantId,
          name: productData.name,
          description: productData.description,
          category: productData.category,
          price: productData.price,
          is_active: productData.isActive,
          preparation_time: productData.preparationTime,
          allergens: productData.allergens,
          image_knowledge_base_id: productData.imageKnowledgeBaseId || null,
        })
        .select()
        .single();

      if (error || !newProd) {
        return { data: null, error: handleSupabaseError(error) };
      }

      const newProdRow = newProd as unknown as MenuProductRow;

      // Si viene receta, insertar los ingredientes
      if (recipe && recipe.length > 0) {
        const recipeInserts = recipe.map((r) => ({
          product_id: newProdRow.id,
          ingredient_id: r.ingredientId,
          quantity: r.quantity,
        }));

        const { error: recipeError } = await supabase.from("product_recipes").insert(recipeInserts);

        if (recipeError) {
          console.error("[MenuProductsRepository] Error saving recipe:", recipeError);
        }
      }

      return this.findById(newProdRow.id, tenantId);
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateMenuProductInput
  ): Promise<RepoResult<MenuProduct>> {
    try {
      const supabase = await db();
      const { recipe, ...productData } = input;

      const updatePayload: Record<string, string | number | boolean | string[] | null> = {
        updated_at: new Date().toISOString(),
      };
      if (productData.name !== undefined) updatePayload.name = productData.name;
      if (productData.description !== undefined)
        updatePayload.description = productData.description;
      if (productData.category !== undefined) updatePayload.category = productData.category;
      if (productData.price !== undefined) updatePayload.price = productData.price;
      if (productData.isActive !== undefined) updatePayload.is_active = productData.isActive;
      if (productData.preparationTime !== undefined)
        updatePayload.preparation_time = productData.preparationTime;
      if (productData.allergens !== undefined) updatePayload.allergens = productData.allergens;
      if (productData.imageKnowledgeBaseId !== undefined)
        updatePayload.image_knowledge_base_id = productData.imageKnowledgeBaseId || null;

      const { error } = await supabase
        .from("menu_products")
        .update(updatePayload)
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (error) return { data: null, error: handleSupabaseError(error) };

      // Si se especificó receta, reemplazarla
      if (recipe !== undefined) {
        await supabase.from("product_recipes").delete().eq("product_id", id);
        if (recipe.length > 0) {
          const recipeInserts = recipe.map((r) => ({
            product_id: id,
            ingredient_id: r.ingredientId,
            quantity: r.quantity,
          }));
          await supabase.from("product_recipes").insert(recipeInserts);
        }
      }

      return this.findById(id, tenantId);
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async delete(id: string, tenantId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const supabase = await db();
      const { error } = await supabase
        .from("menu_products")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) return { success: false, error: handleSupabaseError(error) };
      return { success: true, error: null };
    } catch (e) {
      return { success: false, error: handleSupabaseError(e) };
    }
  }
}

// -------------------------------------------------------------
// INGREDIENTS REPOSITORY
// -------------------------------------------------------------

export class IngredientsRepository {
  async findByTenant(tenantId: string): Promise<RepoListResult<Ingredient>> {
    try {
      const supabase = await db();
      const { data, error } = await supabase
        .from("ingredients")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      if (error) return { data: [], error: handleSupabaseError(error) };

      const rows = (data || []) as unknown as IngredientDbRow[];
      const ingredients: Ingredient[] = rows.map((row: IngredientDbRow) => {
        const stockCurrent = Number(row.stock_current) || 0;
        const stockMin = Number(row.stock_min) || 0;
        return {
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          unit: row.unit as StockUnit,
          stockCurrent,
          stockMin,
          costPerUnit: Number(row.cost_per_unit) || 0,
          stockStatus: computeIngredientStockStatus(stockCurrent, stockMin),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      return { data: ingredients, error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findById(id: string, tenantId: string): Promise<RepoResult<Ingredient>> {
    try {
      const supabase = await db();
      const { data, error } = await supabase
        .from("ingredients")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) return { data: null, error: handleSupabaseError(error) };
      if (!data) return { data: null, error: "Ingrediente no encontrado" };

      const row = data as unknown as IngredientDbRow;
      const stockCurrent = Number(row.stock_current) || 0;
      const stockMin = Number(row.stock_min) || 0;
      return {
        data: {
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          unit: row.unit as StockUnit,
          stockCurrent,
          stockMin,
          costPerUnit: Number(row.cost_per_unit) || 0,
          stockStatus: computeIngredientStockStatus(stockCurrent, stockMin),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        error: null,
      };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async create(tenantId: string, input: CreateIngredientInput): Promise<RepoResult<Ingredient>> {
    try {
      const supabase = await db();
      const { data, error } = await supabase
        .from("ingredients")
        .insert({
          tenant_id: tenantId,
          name: input.name,
          unit: input.unit,
          stock_current: input.stockCurrent,
          stock_min: input.stockMin,
          cost_per_unit: input.costPerUnit,
        })
        .select()
        .single();

      if (error || !data) return { data: null, error: handleSupabaseError(error) };

      const newRow = data as unknown as IngredientDbRow;
      return this.findById(newRow.id, tenantId);
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateIngredientInput
  ): Promise<RepoResult<Ingredient>> {
    try {
      const supabase = await db();
      const payload: Record<string, string | number | null> = {
        updated_at: new Date().toISOString(),
      };
      if (input.name !== undefined) payload.name = input.name;
      if (input.unit !== undefined) payload.unit = input.unit;
      if (input.stockCurrent !== undefined) payload.stock_current = input.stockCurrent;
      if (input.stockMin !== undefined) payload.stock_min = input.stockMin;
      if (input.costPerUnit !== undefined) payload.cost_per_unit = input.costPerUnit;

      const { error } = await supabase
        .from("ingredients")
        .update(payload)
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (error) return { data: null, error: handleSupabaseError(error) };

      return this.findById(id, tenantId);
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async delete(id: string, tenantId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const supabase = await db();
      const { error } = await supabase
        .from("ingredients")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) return { success: false, error: handleSupabaseError(error) };
      return { success: true, error: null };
    } catch (e) {
      return { success: false, error: handleSupabaseError(e) };
    }
  }

  async adjustStock(
    tenantId: string,
    ingredientId: string,
    movementType: StockMovementType,
    quantity: number,
    reason: string
  ): Promise<RepoResult<Ingredient>> {
    try {
      const supabase = await db();
      const cur = await this.findById(ingredientId, tenantId);
      if (cur.error || !cur.data)
        return { data: null, error: cur.error || "Ingrediente no encontrado" };

      let delta = quantity;
      if (movementType === "merma" || movementType === "venta") {
        delta = -Math.abs(quantity);
      } else if (movementType === "reposicion") {
        delta = Math.abs(quantity);
      } // ajuste_manual usa quantity directo

      const newStock = Math.max(0, cur.data.stockCurrent + delta);

      const { error: updErr } = await supabase
        .from("ingredients")
        .update({ stock_current: newStock, updated_at: new Date().toISOString() })
        .eq("id", ingredientId)
        .eq("tenant_id", tenantId);

      if (updErr) return { data: null, error: handleSupabaseError(updErr) };

      // Registrar movimiento inmutable
      await supabase.from("stock_movements").insert({
        tenant_id: tenantId,
        ingredient_id: ingredientId,
        movement_type: movementType,
        quantity: delta,
        reason: reason,
      });

      return this.findById(ingredientId, tenantId);
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

// -------------------------------------------------------------
// STOCK MOVEMENTS REPOSITORY
// -------------------------------------------------------------

export class StockMovementsRepository {
  async findByTenant(
    tenantId: string,
    filters?: { ingredientId?: string; movementType?: string; limit?: number }
  ): Promise<RepoListResult<StockMovement>> {
    try {
      const supabase = await db();
      let query = supabase
        .from("stock_movements")
        .select(
          `
          id,
          tenant_id,
          ingredient_id,
          movement_type,
          quantity,
          reason,
          order_id,
          reservation_id,
          created_at,
          ingredients (
            name
          )
        `
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(filters?.limit || 50);

      if (filters?.ingredientId) {
        query = query.eq("ingredient_id", filters.ingredientId);
      }
      if (filters?.movementType && filters.movementType !== "all") {
        query = query.eq("movement_type", filters.movementType);
      }

      const { data, error } = await query;
      if (error) return { data: [], error: handleSupabaseError(error) };

      const rows = (data || []) as unknown as StockMovementRow[];
      const movements: StockMovement[] = rows.map((row: StockMovementRow) => ({
        id: row.id,
        tenantId: row.tenant_id,
        ingredientId: row.ingredient_id,
        ingredientName: row.ingredients?.name || "Ingrediente",
        movementType: row.movement_type as StockMovementType,
        quantity: Number(row.quantity) || 0,
        reason: row.reason || "",
        orderId: row.order_id || undefined,
        reservationId: row.reservation_id || undefined,
        createdAt: row.created_at,
      }));

      return { data: movements, error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }
}
