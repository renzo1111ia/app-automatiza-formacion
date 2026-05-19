import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: variant, error } = await supabase
    .from('ai_agent_variants')
    .select('id, prompt_text')
    .eq('is_active', true)
    .maybeSingle();
    
  if (error) {
    console.error('Error fetching prompt:', error);
    return;
  }
  
  console.log('AI AGENT PROMPT TEXT:');
  console.log(variant?.prompt_text);
}

main();
