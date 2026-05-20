import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'ai_agent_variants' });
  if (error) {
    // If RPC doesn't exist, query using custom query or just select a single row and print its keys
    console.log('RPC get_table_columns not found, selecting single row instead:');
    const { data: row } = await supabase.from('lead_cualificacion').select('*').limit(1).single();
    console.log('Keys:', Object.keys(row || {}));
  } else {
    console.log('Columns:', data);
  }
}

main();
