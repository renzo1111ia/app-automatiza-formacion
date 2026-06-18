// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { getAuthServiceRoleKey } from "./src/lib/auth-config";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:8100";
const serviceKey = getAuthServiceRoleKey();

const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false }
});

async function main() {
    console.log("Checking Tenant Configs:");
    const { data: tenants } = await supabase.from("tenants").select("id, name, config");
    tenants?.forEach(t => {
        console.log(`\nTenant: ${t.name} (ID: ${t.id})`);
        console.log(`Config structure keys:`, Object.keys(t.config || {}));
        if (t.config) {
            console.log(`Whatsapp config:`, (t.config as any).whatsapp);
        }
    });
}

main().catch(console.error);
