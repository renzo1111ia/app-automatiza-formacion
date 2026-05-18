-- ============================================================
-- ESDEN Analytics Dashboard — Dynamic KPI Engine
-- Evaluates advanced dynamic formulas in the DB.
-- ============================================================

CREATE OR REPLACE FUNCTION get_dynamic_kpi_value(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_calc_type TEXT,        -- 'count', 'sum', 'avg'
  p_target_col TEXT,       -- column name or '*'
  p_is_extra_target BOOLEAN, -- is target inside extra_data?
  p_cond_col TEXT,         -- condition column name (nullable)
  p_is_extra_cond BOOLEAN, -- is condition inside extra_data?
  p_cond_op TEXT,          -- '=', '!=', 'ILIKE', '>', '<' (nullable)
  p_cond_val TEXT          -- condition value string (nullable)
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sql TEXT;
  v_result NUMERIC;
  v_target_expr TEXT;
  v_cond_expr TEXT;
BEGIN
  -- 1. Construct Target Expression
  IF p_target_col IS NULL OR p_target_col = '' OR p_target_col = '*' THEN
    v_target_expr := '*'; 
  ELSIF p_is_extra_target THEN
    v_target_expr := format('NULLIF(extra_data->>%L, '''')::NUMERIC', p_target_col);
  ELSE
    -- Try casting normal columns to numeric
    v_target_expr := format('NULLIF(%I::TEXT, '''')::NUMERIC', p_target_col);
  END IF;

  -- 2. Construct Calculation
  IF p_calc_type = 'count' THEN
    IF v_target_expr = '*' THEN
       v_sql := 'SELECT COUNT(*)';
    ELSE
       IF p_is_extra_target THEN
          v_sql := format('SELECT COUNT(NULLIF(extra_data->>%L, ''''))', p_target_col);
       ELSE
          v_sql := format('SELECT COUNT(NULLIF(%I::TEXT, ''''))', p_target_col);
       END IF;
    END IF;
  ELSIF p_calc_type = 'sum' THEN
    v_sql := format('SELECT COALESCE(SUM(%s), 0)', v_target_expr);
  ELSIF p_calc_type = 'avg' THEN
    v_sql := format('SELECT COALESCE(AVG(%s), 0)', v_target_expr);
  ELSE
    RETURN 0;
  END IF;

  v_sql := v_sql || ' FROM public.lead WHERE fecha_ingreso_crm >= $1 AND fecha_ingreso_crm <= $2';

  -- 3. Construct Condition Expression
  IF p_cond_col IS NOT NULL AND p_cond_col != '' AND p_cond_op IS NOT NULL THEN
    IF p_is_extra_cond THEN
       v_cond_expr := format('extra_data->>%L', p_cond_col);
    ELSE
       v_cond_expr := format('%I::TEXT', p_cond_col);
    END IF;

    IF p_cond_op = '=' THEN
       v_sql := v_sql || format(' AND %s = $3', v_cond_expr);
    ELSIF p_cond_op = '!=' THEN
       v_sql := v_sql || format(' AND %s != $3', v_cond_expr);
    ELSIF p_cond_op = 'ILIKE' THEN
       v_sql := v_sql || format(' AND %s ILIKE $3', v_cond_expr);
    ELSIF p_cond_op = '>' THEN
       v_sql := v_sql || format(' AND %s::NUMERIC > $3::NUMERIC', v_cond_expr);
    ELSIF p_cond_op = '<' THEN
       v_sql := v_sql || format(' AND %s::NUMERIC < $3::NUMERIC', v_cond_expr);
    ELSE
       -- Fallback safe for unexpected ops
       RETURN 0;
    END IF;
    
    -- Debug statement useful if we look at Postgres logs
    -- RAISE NOTICE 'Executing SQL: %', v_sql;
    EXECUTE v_sql INTO v_result USING p_from, p_to, p_cond_val;
  ELSE
    EXECUTE v_sql INTO v_result USING p_from, p_to;
  END IF;

  RETURN COALESCE(v_result, 0);
EXCEPTION WHEN OTHERS THEN
  -- Unsafe casting or column not found results in 0 rather than crashing
  RETURN 0;
END;
$$;
