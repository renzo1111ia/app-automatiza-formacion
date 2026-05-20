import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: variant } = await supabase
    .from('ai_agent_variants')
    .select('id, prompt_text')
    .eq('is_active', true)
    .maybeSingle();
    
  console.log('AI AGENT PROMPT 4000-10000 CHARACTERS:');
  console.log(variant?.prompt_text?.substring(4000, 10000));
}

main();
