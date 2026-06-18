// @ts-nocheck
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
    console.log("Database diagnostic from workspace:");
    console.log("Supabase URL:", url);
    
    const { data: tenants, error: tErr } = await supabase.from("tenants").select("id, name");
    if (tErr) {
        console.error("Error reading tenants:", tErr);
        return;
    }
    console.log("Tenants found:", tenants);
    
    for (const t of tenants || []) {
        const { count: leadCount } = await supabase.from("lead").select("id", { count: "exact", head: true }).eq("tenant_id", t.id);
        const { count: callCount } = await supabase.from("llamadas").select("id", { count: "exact", head: true }).eq("tenant_id", t.id);
        const { count: msgCount } = await supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("tenant_id", t.id);
        const { count: waConvCount } = await supabase.from("conversaciones_whatsapp").select("id", { count: "exact", head: true }).eq("tenant_id", t.id);
        
        console.log(`\nTenant '${t.name}' (ID: ${t.id}):`);
        console.log(`  Leads count: ${leadCount}`);
        console.log(`  Calls count: ${callCount}`);
        console.log(`  Chat Messages count: ${msgCount}`);
        console.log(`  conversaciones_whatsapp count: ${waConvCount}`);
        
        // Fetch some leads with their details
        const { data: leads } = await supabase
            .from("lead")
            .select(`
                id, nombre, apellido, telefono, origen,
                llamadas ( id ),
                conversaciones_whatsapp ( id )
            `)
            .eq("tenant_id", t.id)
            .limit(5);
        
        console.log(`  Sample leads:`);
        leads?.forEach(l => {
            const hasCalls = ((l.llamadas as any[])?.length || 0) > 0;
            const hasWA = ((l.conversaciones_whatsapp as any[])?.length || 0) > 0;
            console.log(`    - ${l.nombre} ${l.apellido} (${l.telefono}, origen: ${l.origen}) -> tiene_voz: ${hasCalls}, tiene_whatsapp: ${hasWA}`);
        });
    }
}

main().catch(console.error);
