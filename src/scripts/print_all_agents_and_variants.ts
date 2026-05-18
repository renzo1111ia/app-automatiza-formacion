import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: agents } = await supabase.from('ai_agents').select('*');
  console.log('AI AGENTS:');
  console.log(JSON.stringify(agents, null, 2));

  const { data: variants } = await supabase.from('ai_agent_variants').select('*');
  console.log('AI AGENT VARIANTS:');
  console.log(JSON.stringify(variants, null, 2));
}

main();
