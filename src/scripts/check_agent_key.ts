import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: variant } = await supabase
        .from("ai_agent_variants")
        .select("api_key, tracked_variables, is_active, tenant_id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
    
    console.log("Active Agent Variant:");
    console.log("Tenant ID:", variant?.tenant_id);
    console.log("Is Active:", variant?.is_active);
    console.log("Tracked Variables:", variant?.tracked_variables);
    console.log("API Key:", variant?.api_key ? (variant.api_key.substring(0, 8) + "...") : "null");
}

main();
