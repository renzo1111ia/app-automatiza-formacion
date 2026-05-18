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
    .select('id, agent_id, is_active, version_label, tracked_variables');
  
  if (error) console.error(error);
  else console.log('Variants tracked variables:', JSON.stringify(variants, null, 2));

  const { data: agents } = await supabase
    .from('ai_agents')
    .select('id, name');
  console.log('Agents:', JSON.stringify(agents, null, 2));

  const { data: leads } = await supabase
    .from('lead')
    .select('id, nombre, ai_agent_id');
  console.log('Leads:', JSON.stringify(leads, null, 2));
}

main();
