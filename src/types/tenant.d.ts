export interface Tenant {
  id: string;
  name: string;
  username?: string;
  supabase_url: string;
  supabase_anon_key: string;
  client_email?: string;
  is_admin?: boolean;
  auth_user_id?: string;
  api_type?: "internal" | "client";
  config: Record<string, unknown>;
  api_key?: string | null;
  daily_spend_limit?: number;
  monthly_spend_limit?: number;
  current_daily_spend?: number;
  current_monthly_spend?: number;
  last_spend_reset?: string;
  created_at?: string;
  updated_at?: string;
}
export interface KpiPart {
  id: string;
  targetCol: string;
  calcType: "count" | "sum" | "avg";
  condCol?: string;
  condOp?: "=" | "!=" | "ILIKE" | ">" | "<";
  condVal?: string;
  isExtraTarget?: boolean;
  isExtraCond?: boolean;
}
export interface KpiConfig {
  id: string;
  label: string;
  icon: string;
  color: string;
  size: "3" | "4" | "6" | "8" | "9" | "12";
  staticKey?: string;
  isVisible?: boolean;
  suffix?: string;
  group?: string;
  isAdvanced?: boolean;
  formula?: string;
  parts?: Record<string, KpiPart>;
  calcType?: "count" | "sum" | "avg";
  targetCol?: string;
  isExtraTarget?: boolean;
  condCol?: string;
  isExtraCond?: boolean;
  condOp?: "=" | "!=" | "ILIKE" | ">" | "<";
  condVal?: string;
  hasDenominator?: boolean;
  denomCalcType?: "count" | "sum" | "avg";
  denomTargetCol?: string;
  denomIsExtraTarget?: boolean;
  denomCondCol?: string;
  denomIsExtraCond?: boolean;
  denomCondOp?: "=" | "!=" | "ILIKE" | ">" | "<";
  denomCondVal?: string;
  isPercentage?: boolean;
  valType?: "duration";
  order?: number;
}
export interface ChartConfig {
  id: string;
  type: "area" | "bar" | "donut" | "vertical-bar" | "heatmap" | "funnel";
  title: string;
  dataKey: string;
  xKey?: string;
  yKey?: string;
  calcType?: "count" | "sum" | "avg";
  condCol?: string;
  condOp?: "=" | "!=" | "ILIKE" | ">" | "<";
  condVal?: string;
  size: "4" | "6" | "8" | "12";
  isVisible?: boolean;
  isDonut?: boolean;
  centerLabel?: string;
  isAdvanced?: boolean;
  formula?: string;
  parts?: Record<string, KpiPart>;
  order?: number;
}
export interface TenantConfig {
  tenantId: string;
  tenantName: string;
  config?: Record<string, unknown>;
  isAdmin?: boolean;
}
