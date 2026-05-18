
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

async function normalizeLeads() {
    console.log("🚀 Starting Lead Phone Normalization (ESM)...");

    // 1. Fetch leads where telefono doesn't start with '+'
    const { data: leads, error } = await supabase
        .from('lead')
        .select('id, telefono')
        .not('telefono', 'like', '+%');

    if (error) {
        console.error("❌ Error fetching leads:", error);
        return;
    }

    if (!leads || leads.length === 0) {
        console.log("✅ No leads found needing normalization.");
        return;
    }

    console.log(`[INFO] Found ${leads.length} leads to normalize.`);

    let successCount = 0;
    let errorCount = 0;

    for (const lead of leads) {
        let originalPhone = lead.telefono || "";
        // Clean and add +
        let clean = originalPhone.replace(/[^\d]/g, '');
        if (clean.length > 0 && !originalPhone.startsWith('+')) {
            let normalizedPhone = '+' + clean;
            
            console.log(`[UPDATING] Lead ${lead.id}: ${originalPhone} -> ${normalizedPhone}`);
            
            const { error: updateError } = await supabase
                .from('lead')
                .update({ telefono: normalizedPhone })
                .eq('id', lead.id);

            if (updateError) {
                console.error(`  ❌ Failed to update lead ${lead.id}:`, updateError.message);
                errorCount++;
            } else {
                successCount++;
            }
        }
    }

    console.log("\n--- Summary ---");
    console.log(`Total processed: ${leads.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log("----------------\n");
}

normalizeLeads();
