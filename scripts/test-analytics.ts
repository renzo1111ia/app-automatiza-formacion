import { getKpiGenerales, getDynamicKpis, getDynamicChartSeries } from "../src/lib/actions/analytics";
import { getActiveTenantConfig, getTenants } from "../src/lib/actions/tenant";
import { DEFAULT_OVERVIEW_KPIS, DEFAULT_OVERVIEW_CHARTS } from "../src/lib/constants/kpi-defaults";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function testTenant(tenantId: string, name: string) {
    console.log(`\n======================================================`);
    console.log(`Testing Tenant: ${name} (${tenantId})`);
    console.log(`======================================================`);
    
    // Simulate parseFilters for "30d" (assuming current date is 2026-06-12)
    const now = new Date("2026-06-12T12:00:00Z");
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = now.toISOString();
    
    console.log(`Date range: from=${from} to=${to}`);
    
    try {
        console.log("Calling getKpiGenerales...");
        const kpi = await getKpiGenerales(from, to, {});
        console.log("getKpiGenerales success!", {
            total_leads: kpi.total_leads,
            total_llamadas: kpi.total_llamadas,
            total_minutos: kpi.total_minutos
        });
    } catch (err) {
        console.error("getKpiGenerales failed:", err);
    }
    
    try {
        console.log("Calling getDynamicKpis...");
        const dynamicValues = await getDynamicKpis(
            from,
            to,
            DEFAULT_OVERVIEW_KPIS.filter((k) => !k.staticKey),
            {}
        );
        console.log("getDynamicKpis success!", dynamicValues);
    } catch (err) {
        console.error("getDynamicKpis failed:", err);
    }
}

async function main() {
    // We need to bypass getActiveTenantId cookie check by manually setting process.env or mocking
    // But since getActiveTenantId reads cookies() which requires a Request context, we should look
    // at how we can mock it or check if getActiveTenantConfig can be bypassed.
    // Wait, getActiveTenantId reads from cookies() which fails in node scripts.
    // Let's modify the imports or functions to check.
    console.log("To run server actions directly in node, we need to mock cookies().");
    console.log("Since we can't easily do it without mock-cookies, let's write a version that directly queries the DB using Supabase client.");
}

main().catch(console.error);
