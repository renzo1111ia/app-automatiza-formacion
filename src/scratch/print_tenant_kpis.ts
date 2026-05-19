import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantId = "47e84fa2-73f3-4e23-9267-1e49d4442f70";

async function main() {
    const { data: tenant } = await supabase
        .from("tenants")
        .select("config")
        .eq("id", tenantId)
        .single();
    
    console.log(JSON.stringify(tenant?.config?.kpis || [], null, 2));
}

main().catch(console.error);
