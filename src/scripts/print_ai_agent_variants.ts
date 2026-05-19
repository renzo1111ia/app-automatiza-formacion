import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: variants, error } = await supabase
    .from('ai_agent_variants')
    .select('*');
    
  if (error) {
    console.error('Error fetching variants:', error);
    return;
  }
  
  console.log('AI AGENT VARIANTS IN DB:');
  console.log(JSON.stringify(variants, null, 2));
}

main();
