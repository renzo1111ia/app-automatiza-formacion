
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

async function check() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", "c379840c-1c8a-418e-b5c1-79c589406551")
        .single();

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Appointment Details:");
    console.log(JSON.stringify(data, null, 2));
}

check();
