import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:8100";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false }
});

async function main() {
    console.log("Checking AI Agents and Variants:");
    
    const { data: agents, error: aErr } = await supabase.from("ai_agents").select("*");
    if (aErr) {
        console.error("Error fetching agents:", aErr);
        return;
    }
    console.log("Agents found count:", agents?.length);
    agents?.forEach(a => {
        console.log(`- Agent '${a.name}' (ID: ${a.id}) | Type: ${a.type} | Status: ${a.status} | Tenant: ${a.tenant_id}`);
    });
    
    const { data: variants, error: vErr } = await supabase.from("ai_agent_variants").select("*");
    if (vErr) {
        console.error("Error fetching variants:", vErr);
        return;
    }
    console.log("\nVariants found count:", variants?.length);
    variants?.forEach(v => {
        console.log(`- Variant ID: ${v.id} | Agent ID: ${v.agent_id} | Label: ${v.version_label} | Active: ${v.is_active}`);
        console.log(`  Model Provider: ${v.model_provider} | Model Name: ${v.model_name}`);
        console.log(`  Has API Key: ${!!v.api_key} | API Key length: ${v.api_key?.length || 0}`);
        console.log(`  Prompt preview: ${v.prompt_text?.substring(0, 100)}...`);
    });
}

main().catch(console.error);
