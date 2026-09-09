import { z } from "zod";
import { uuidSchema, tenantIdSchema } from "./_base";

// -------------------------------------------------------------
// ENUMS & CONSTANTES
// -------------------------------------------------------------

export const MenuCategoryEnum = z.enum(["entrante", "principal", "postre", "bebida", "especial"]);

export const StockUnitEnum = z.enum(["unidad", "kg", "gr", "lt", "ml"]);

export const StockMovementTypeEnum = z.enum(["venta", "merma", "reposicion", "ajuste_manual"]);

export const StockStatusEnum = z.enum(["disponible", "bajo", "agotado"]);

// -------------------------------------------------------------
// RECIPE ITEM SCHEMA
// -------------------------------------------------------------

export const RecipeItemInputSchema = z.object({
  ingredientId: uuidSchema,
  quantity: z.number().positive("La cantidad debe ser mayor a cero"),
});

export const RecipeItemSchema = z.object({
  id: z.string().optional(),
  ingredientId: uuidSchema,
  ingredientName: z.string().optional(),
  quantity: z.number().positive(),
  unit: StockUnitEnum.optional(),
});

// -------------------------------------------------------------
// MENU PRODUCT SCHEMAS
// -------------------------------------------------------------

export const CreateMenuProductSchema = z.object({
  tenantId: tenantIdSchema,
  name: z.string().min(2, "El nombre del producto debe tener al menos 2 caracteres"),
  description: z.string().optional().default(""),
  category: MenuCategoryEnum.default("principal"),
  price: z.number().min(0, "El precio no puede ser negativo"),
  isActive: z.boolean().default(true),
  preparationTime: z.number().int().min(0).default(15),
  allergens: z.array(z.string()).default([]),
  imageKnowledgeBaseId: uuidSchema.nullable().optional(),
  recipe: z.array(RecipeItemInputSchema).optional().default([]),
});

export const UpdateMenuProductSchema = CreateMenuProductSchema.partial().omit({ tenantId: true });

// -------------------------------------------------------------
// INGREDIENT SCHEMAS
// -------------------------------------------------------------

export const CreateIngredientSchema = z.object({
  tenantId: tenantIdSchema,
  name: z.string().min(2, "El nombre del ingrediente debe tener al menos 2 caracteres"),
  unit: StockUnitEnum.default("unidad"),
  stockCurrent: z.number().default(0),
  stockMin: z.number().min(0).default(5),
  costPerUnit: z.number().min(0).default(0),
});

export const UpdateIngredientSchema = CreateIngredientSchema.partial().omit({ tenantId: true });

// -------------------------------------------------------------
// STOCK ADJUSTMENT & DEDUCTION SCHEMAS
// -------------------------------------------------------------

export const StockAdjustmentSchema = z.object({
  tenantId: tenantIdSchema,
  ingredientId: uuidSchema,
  movementType: StockMovementTypeEnum,
  quantity: z.number(), // positivo para reposición, negativo o positivo según tipo
  reason: z.string().min(2, "El motivo es requerido"),
});

export const OrderItemDeductSchema = z.object({
  productId: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  quantity: z.number().positive(),
});

export const DeductStockOrderSchema = z.object({
  tenantId: tenantIdSchema,
  reservationId: z.string().optional(),
  orderId: z.string().optional(),
  items: z.array(OrderItemDeductSchema).min(1, "Debe incluir al menos un ítem"),
});

export type CreateMenuProductInput = z.infer<typeof CreateMenuProductSchema>;
export type UpdateMenuProductInput = z.infer<typeof UpdateMenuProductSchema>;
export type CreateIngredientInput = z.infer<typeof CreateIngredientSchema>;
export type UpdateIngredientInput = z.infer<typeof UpdateIngredientSchema>;
export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;
export type DeductStockOrderInput = z.infer<typeof DeductStockOrderSchema>;
