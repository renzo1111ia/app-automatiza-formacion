import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:8100";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false }
});

async function main() {
    console.log("Database detail check:");
    
    const tenantId = "335be450-c821-4922-a4d9-ad268ac2c394";
    
    const { data: leads, error } = await supabase
        .from("lead")
        .select("id, nombre, fecha_ingreso_crm, fecha_creacion, tenant_id")
        .eq("tenant_id", tenantId);
        
    if (error) {
        console.error("Error fetching leads:", error);
        return;
    }
    
    console.log(`Leads count: ${leads?.length}`);
    leads?.slice(0, 5).forEach((l, idx) => {
        console.log(`Lead ${idx + 1}: name=${l.nombre}, fecha_ingreso_crm=${l.fecha_ingreso_crm}, fecha_creacion=${l.fecha_creacion}`);
    });
    
    const { data: calls, error: callErr } = await supabase
        .from("llamadas")
        .select("id, id_lead, fecha_inicio, fecha_creacion")
        .eq("tenant_id", tenantId);
        
    if (callErr) {
        console.error("Error fetching calls:", callErr);
        return;
    }
    console.log(`Calls count: ${calls?.length}`);
    calls?.slice(0, 5).forEach((c, idx) => {
        console.log(`Call ${idx + 1}: id_lead=${c.id_lead}, fecha_inicio=${c.fecha_inicio}, fecha_creacion=${c.fecha_creacion}`);
    });
}

main().catch(console.error);
