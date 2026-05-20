import "dotenv/config";
import { getAdminSupabaseClient } from "../lib/supabase/server";

async function main() {
    const supabase = await getAdminSupabaseClient();
    const { data, error } = await supabase.from("appointments").select("status, id, lead_id").limit(10);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Appointments:");
        console.log(data);
    }
}

main();
