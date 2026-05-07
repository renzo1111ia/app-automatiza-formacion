
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

async function check() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("created_at", "2026-05-06T22:14:00Z")
        .lte("created_at", "2026-05-06T22:17:00Z");

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Appointments created between 22:14 and 22:17 UTC:");
    data.forEach(a => {
        console.log(`- ID: ${a.id} | Lead: ${a.lead_id} | Time: ${a.scheduled_at} | Status: ${a.status} | Created: ${a.created_at}`);
    });
}

check();
