import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking appointments table...");
    try {
        const { data, error, count } = await supabase.from("appointments").select("*", { count: "exact", head: false }).limit(5);
        if (error) {
            console.error("Error reading appointments:", error.message);
        } else {
            console.log(`appointments count: ${count}`);
            console.log("Sample appointments:", JSON.stringify(data, null, 2));
        }
    } catch (e: unknown) {
        console.error("Exception checking appointments:", e instanceof Error ? e.message : String(e));
    }

    console.log("\nChecking agendamientos table...");
    try {
        const { data, error, count } = await supabase.from("agendamientos").select("*", { count: "exact", head: false }).limit(5);
        if (error) {
            console.error("Error reading agendamientos:", error.message);
        } else {
            console.log(`agendamientos count: ${count}`);
            console.log("Sample agendamientos:", JSON.stringify(data, null, 2));
        }
    } catch (e: unknown) {
        console.error("Exception checking agendamientos:", e instanceof Error ? e.message : String(e));
    }
}

run();
