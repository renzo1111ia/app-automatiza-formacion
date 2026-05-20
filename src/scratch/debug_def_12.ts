import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
process.env.ACTIVE_TENANT_ID = "47e84fa2-73f3-4e23-9267-1e49d4442f70";

import { getSingleDynamicKpi } from "../lib/actions/analytics";
import { getActiveTenantConfig } from "../lib/actions/tenant";
import { parseFilters } from "../lib/utils/date-filters";
import { KpiConfig } from "@/types/tenant";

async function main() {
    const { from, to, filters } = parseFilters({});
    const tenantConfig = await getActiveTenantConfig();
    console.log("=== TENANT CONFIG ===");
    console.log("tenantConfig ID:", tenantConfig?.id);
    console.log("tenantConfig Name:", tenantConfig?.name);
    console.log("tenantConfig config structure keys:", Object.keys(tenantConfig?.config || {}));
    
    const configObj = (tenantConfig?.config as Record<string, unknown>) || {};
    const kpis = (configObj.kpis as KpiConfig[]) || [];
    
    const def12 = kpis.find((k: KpiConfig) => k.id === "def-12")!;
    console.log("=== KPI DEF-12 CONFIG ===");
    console.log(def12);
    
    const result12 = await getSingleDynamicKpi(def12, from, to, filters);
    console.log("=== RESULT DEF-12 ===");
    console.log(result12);

    const def13 = kpis.find((k: KpiConfig) => k.id === "def-13")!;
    console.log("\n=== KPI DEF-13 CONFIG ===");
    console.log(def13);
    
    const result13 = await getSingleDynamicKpi(def13, from, to, filters);
    console.log("=== RESULT DEF-13 ===");
    console.log(result13);
}

main().catch(console.error);
