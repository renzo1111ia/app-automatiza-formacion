import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching all leads...");
    const { data: leads, error } = await supabase.from("lead").select("id, tenant_id, metadata");
    if (error) {
        console.error("Error fetching leads:", error);
        return;
    }

    console.log(`Found ${leads.length} leads. Syncing to lead_cualificacion...`);
    let count = 0;
    
    for (const lead of leads) {
        // Try to get the qualification from metadata
        const metadata = lead.metadata || {};
        
        let qual = metadata.QUALIFIED || metadata.cualificacion || "";
        const motivo = metadata.MOTIVO_DESCARTE || "";

        
        // Normalize
        if (typeof qual === 'string') qual = qual.trim();
        if (qual === "") continue; // Skip if no qualification info yet

        // Upsert into lead_cualificacion
        // First check if it exists
        const { data: existing } = await supabase.from("lead_cualificacion").select("id").eq("id_lead", lead.id).single();
        
        const payload = {
            tenant_id: lead.tenant_id,
            id_lead: lead.id,
            cualificacion: qual,
            motivo_anulacion: motivo,
        };

        let res;
        if (existing) {
            res = await supabase.from("lead_cualificacion").update(payload).eq("id", existing.id);
        } else {
            res = await supabase.from("lead_cualificacion").insert(payload);
        }

        if (res.error) {
            console.error(`Error syncing lead ${lead.id}:`, res.error.message);
        } else {
            count++;
        }
    }
    
    console.log(`Successfully synced ${count} lead qualification records!`);
}

main();
