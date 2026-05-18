
"use server";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const url = "http://interno-supabase-a201be-46-62-193-169.traefik.me";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzI0OTEyMjksImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.5VpQVwUhqDkHgplZiPE4iGjduuB2NfGNq-5vsASGAbI";

const supabase = createClient(url, key);

async function cleanAllDemoData() {
    console.log("🧹 Purgando absolutamente todos los datos de laboratorio...");
    
    // 1. Purgar leads demo
    const { count: lCount, error: lErr } = await supabase
        .from('lead')
        .delete({ count: 'exact' })
        .eq('origen', 'LAB DEMO');
        
    if (lErr) console.error("Error Leads:", lErr.message);
    else console.log(`Leads eliminados: ${lCount}`);

    // 2. Purgar campañas demo
    const { count: cCount, error: cErr } = await supabase
        .from('campanas')
        .delete({ count: 'exact' })
        .like('nombre', 'Lab Demo%');
        
    if (cErr) console.error("Error Campañas:", cErr.message);
    else console.log(`Campañas eliminadas: ${cCount}`);

    console.log("✨ Sistema limpio y listo para producción.");
}

cleanAllDemoData();
