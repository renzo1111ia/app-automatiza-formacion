
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function getVirginiaPromptFull() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
        console.error('Missing credentials');
        return;
    }

    const supabase = createClient(url, key);

    const { data: variants, error } = await supabase
        .from('ai_agent_variants')
        .select('*')
        .ilike('prompt_text', '%Virginia%')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching variants:', error);
        return;
    }

    console.log('--- VIRGINIA PROMPT FULL ---');
    if (variants && variants.length > 0) {
        console.log(variants[0].prompt_text);
    }
}

getVirginiaPromptFull();
