import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantId = "47e84fa2-73f3-4e23-9267-1e49d4442f70";

async function main() {
    console.log("=== CHECKING ALL DB TABLES FOR TENANT ===");
    
    // 1. Leads
    const { data: leads, error: errLeads } = await supabase.from("lead").select("*").eq("tenant_id", tenantId);
    console.log(`\n--- LEADS (Total: ${leads?.length || 0}) ---`);
    if (errLeads) console.error("Leads error:", errLeads.message);
    else console.log(JSON.stringify(leads, null, 2));

    // 2. Llamadas
    const { data: llamadas, error: errLlamadas } = await supabase.from("llamadas").select("*").eq("tenant_id", tenantId);
    console.log(`\n--- LLAMADAS (Total: ${llamadas?.length || 0}) ---`);
    if (errLlamadas) console.error("Llamadas error:", errLlamadas.message);
    else console.log(JSON.stringify(llamadas, null, 2));

    // 3. Appointments
    const { data: appointments, error: errApps } = await supabase.from("appointments").select("*").eq("tenant_id", tenantId);
    console.log(`\n--- APPOINTMENTS (Total: ${appointments?.length || 0}) ---`);
    if (errApps) console.error("Appointments error:", errApps.message);
    else console.log(JSON.stringify(appointments, null, 2));

    // 4. Agendamientos
    const { data: agendamientos, error: errAgendamientos } = await supabase.from("agendamientos").select("*").eq("tenant_id", tenantId);
    console.log(`\n--- AGENDAMIENTOS (Total: ${agendamientos?.length || 0}) ---`);
    if (errAgendamientos) console.error("Agendamientos error:", errAgendamientos.message);
    else console.log(JSON.stringify(agendamientos, null, 2));

    // 5. Lead Cualificacion
    const { data: cualificaciones, error: errCual } = await supabase.from("lead_cualificacion").select("*").eq("tenant_id", tenantId);
    console.log(`\n--- LEAD CUALIFICACIONES (Total: ${cualificaciones?.length || 0}) ---`);
    if (errCual) console.error("Cualificacion error:", errCual.message);
    else console.log(JSON.stringify(cualificaciones, null, 2));
}

main().catch(console.error);
