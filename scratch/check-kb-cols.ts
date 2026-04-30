
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log("Checking knowledge_base_embeddings columns...");
    const { data, error } = await supabase
        .from('knowledge_base_embeddings')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Sample data:", data[0]);
        console.log("Keys available:", Object.keys(data[0] || {}));
    }
}

checkColumns();
