-- Migración: Sistema de Carta, Inventario y Control de Stock (Fudo POS)
-- Tablas: menu_products, ingredients, product_recipes, stock_movements
-- Función atómica: deduct_stock_for_order()

-- 1. Tabla: productos de carta (menu_products)
CREATE TABLE IF NOT EXISTS public.menu_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'principal' CHECK (category IN ('entrante', 'principal', 'postre', 'bebida', 'especial')),
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  preparation_time INT DEFAULT 15,
  allergens TEXT[] DEFAULT '{}',
  image_knowledge_base_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_products_tenant ON public.menu_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_products_category ON public.menu_products(tenant_id, category);

-- 2. Tabla: insumos e ingredientes (ingredients)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unidad' CHECK (unit IN ('unidad', 'kg', 'gr', 'lt', 'ml')),
  stock_current DECIMAL(10,3) NOT NULL DEFAULT 0,
  stock_min DECIMAL(10,3) NOT NULL DEFAULT 5,
  cost_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_tenant ON public.ingredients(tenant_id);

-- 3. Tabla: recetas BOM (product_recipes)
CREATE TABLE IF NOT EXISTS public.product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.menu_products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_product_recipes_product ON public.product_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_ingredient ON public.product_recipes(ingredient_id);

-- 4. Tabla: historial de movimientos de stock (inmutable)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('venta', 'merma', 'reposicion', 'ajuste_manual')),
  quantity DECIMAL(10,3) NOT NULL,
  reason TEXT,
  order_id TEXT,
  reservation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON public.stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON public.stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(tenant_id, created_at DESC);

-- 5. Función atómica para descontar stock al servir pedido
CREATE OR REPLACE FUNCTION public.deduct_stock_for_order(
  p_tenant_id UUID,
  p_items JSONB,
  p_reservation_id TEXT DEFAULT NULL,
  p_order_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_product_name TEXT;
  v_quantity NUMERIC;
  v_recipe RECORD;
  v_required_qty NUMERIC;
  v_current_stock NUMERIC;
  v_min_stock NUMERIC;
  v_ingredient_name TEXT;
  v_deducted_count INT := 0;
  v_warnings JSONB := '[]'::JSONB;
BEGIN
  -- Validar entrada
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'deducted_items_count', 0,
      'warnings', jsonb_build_array('No items provided')
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULL;
    v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 1);
    
    -- Intentar buscar por product_id si viene
    IF (v_item->>'productId') IS NOT NULL AND (v_item->>'productId') ~* '^[0-9a-f\-]{36}$' THEN
      v_product_id := (v_item->>'productId')::UUID;
    ELSIF (v_item->>'id') IS NOT NULL AND (v_item->>'id') ~* '^[0-9a-f\-]{36}$' THEN
      v_product_id := (v_item->>'id')::UUID;
    END IF;

    -- Si no encontramos por UUID, buscar por nombre exacto o similar
    v_product_name := COALESCE(v_item->>'name', '');
    IF v_product_id IS NULL AND v_product_name <> '' THEN
      SELECT id INTO v_product_id
      FROM public.menu_products
      WHERE tenant_id = p_tenant_id
        AND LOWER(TRIM(name)) = LOWER(TRIM(v_product_name))
      LIMIT 1;
    END IF;

    IF v_product_id IS NOT NULL THEN
      -- Recorrer los ingredientes de la receta del producto
      FOR v_recipe IN 
        SELECT pr.ingredient_id, pr.quantity AS recipe_qty, i.name AS ing_name, i.stock_current, i.stock_min
        FROM public.product_recipes pr
        JOIN public.ingredients i ON i.id = pr.ingredient_id
        WHERE pr.product_id = v_product_id
      LOOP
        v_required_qty := v_recipe.recipe_qty * v_quantity;

        -- Descontar stock
        UPDATE public.ingredients
        SET stock_current = stock_current - v_required_qty,
            updated_at = now()
        WHERE id = v_recipe.ingredient_id
        RETURNING stock_current, stock_min, name INTO v_current_stock, v_min_stock, v_ingredient_name;

        -- Registrar movimiento inmutable de tipo 'venta'
        INSERT INTO public.stock_movements (
          tenant_id,
          ingredient_id,
          movement_type,
          quantity,
          reason,
          order_id,
          reservation_id
        ) VALUES (
          p_tenant_id,
          v_recipe.ingredient_id,
          'venta',
          -v_required_qty,
          'Consumo pedido servido (' || COALESCE(v_product_name, 'Producto') || ' x' || v_quantity || ')',
          p_order_id,
          p_reservation_id
        );

        v_deducted_count := v_deducted_count + 1;

        -- Verificar si quedó en stock bajo o agotado para emitir advertencia
        IF v_current_stock <= v_min_stock THEN
          v_warnings := v_warnings || jsonb_build_object(
            'ingredient_id', v_recipe.ingredient_id,
            'name', v_ingredient_name,
            'stock_current', v_current_stock,
            'stock_min', v_min_stock,
            'status', CASE WHEN v_current_stock <= 0 THEN 'agotado' ELSE 'bajo' END
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deducted_movements_count', v_deducted_count,
    'warnings', v_warnings
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Políticas RLS
ALTER TABLE public.menu_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY service_role_menu_products ON public.menu_products
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_ingredients ON public.ingredients
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_product_recipes ON public.product_recipes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_stock_movements ON public.stock_movements
  FOR ALL USING (auth.role() = 'service_role');

-- Acceso autenticado por tenant
CREATE POLICY tenant_menu_products ON public.menu_products
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tenant_ingredients ON public.ingredients
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tenant_product_recipes ON public.product_recipes
  FOR ALL USING (
    product_id IN (
      SELECT id FROM public.menu_products mp
      JOIN public.tenant_users tu ON tu.tenant_id = mp.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY tenant_stock_movements ON public.stock_movements
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );
