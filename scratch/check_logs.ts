
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

async function check() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Latest 10 Chat Messages:");
    data.forEach(m => {
        console.log(`- ID: ${m.id} | Lead: ${m.lead_id} | Dir: ${m.direction} | Content: ${m.content?.substring(0, 50)}... | Meta: ${JSON.stringify(m.metadata)}`);
    });
}

check();
