
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import process from 'process';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMissingPhotos() {
    console.log("🚀 Fixing missing profile photos...");

    const { data: leads, error } = await supabase
        .from('lead')
        .select('id, nombre, apellido')
        .is('foto_url', null);

    if (error) {
        console.error("❌ Error fetching leads:", error);
        return;
    }

    if (!leads || leads.length === 0) {
        console.log("✅ No leads found missing photos.");
        return;
    }

    console.log(`[INFO] Found ${leads.length} leads without photo.`);

    for (const lead of leads) {
        const fullName = `${lead.nombre || ''} ${lead.apellido || ''}`.trim() || "Prospecto";
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff&size=128`;
        
        console.log(`[UPDATING] Lead ${lead.id}: ${fullName}`);
        await supabase.from('lead').update({ foto_url: avatarUrl }).eq('id', lead.id);
    }

    console.log("✅ All missing photos fixed.");
}

fixMissingPhotos();
