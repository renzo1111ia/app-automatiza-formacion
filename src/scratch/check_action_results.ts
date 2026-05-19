import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Set active tenant ID env var for our resilient fallback
process.env.ACTIVE_TENANT_ID = "47e84fa2-73f3-4e23-9267-1e49d4442f70";

// Import the actions
import { getDynamicKpis, getKpiGenerales } from "../lib/actions/analytics";
import { getActiveTenantConfig } from "../lib/actions/tenant";
import { parseFilters } from "../lib/utils/date-filters";
import { Tenant, KpiConfig } from "@/types/tenant";

interface KpiItem {
    id: string;
    staticKey?: string;
    title: string;
    targetCol?: string;
    calcType?: string;
    condCol?: string;
    condOp?: string;
    condVal?: string;
    denomTargetCol?: string;
    denomCalcType?: string;
    denomCondCol?: string;
    denomCondOp?: string;
    denomCondVal?: string;
    isPercentage?: boolean;
    isAdvanced?: boolean;
    formula?: string;
    parts?: Record<string, {
        targetCol: string;
        calcType: string;
        condCol?: string;
        condOp?: string;
        condVal?: string;
    }>;
}

async function run() {
    console.log("=== EXECUTING SERVER ACTIONS ===");
    
    const searchParams = {}; // default range 30d
    const { from, to, filters } = parseFilters(searchParams);
    
    console.log(`Parsed dates: from=${from} to=${to}`);
    console.log("Filters:", filters);

    const tenantConfig: Tenant | null = await getActiveTenantConfig();
    if (!tenantConfig) {
        console.error("Tenant config not found!");
        return;
    }
    console.log(`Active Tenant: ${tenantConfig.name} (${tenantConfig.id})`);
    
    const configObj = (tenantConfig.config as Record<string, unknown>) || {};
    const kpis = (configObj.kpis as KpiItem[]) || [];
    console.log(`KPIs configured: ${kpis.length}`);
    console.log("Configured KPIs:\n", JSON.stringify(kpis, null, 2));

    const [kpi, dynamicValues] = await Promise.all([
        getKpiGenerales(from, to, filters),
        getDynamicKpis(
            from,
            to,
            kpis.filter((k: KpiItem) => !k.staticKey) as unknown as KpiConfig[],
            filters
        )
    ]);

    console.log("\nStatic KPIs returned by getKpiGenerales:");
    console.log(JSON.stringify(kpi, null, 2));

    console.log("\nDynamic KPIs returned by getDynamicKpis:");
    console.log(JSON.stringify(dynamicValues, null, 2));
}

run().catch((err: Error) => {
    console.error("Script failed:", err.message);
});
