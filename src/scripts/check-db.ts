import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  if (!supabaseUrl) {
      console.error('NEXT_PUBLIC_SUPABASE_URL is not defined');
      return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: tenants, error: tenantsError } = await supabase.from('tenants').select('id, name');
  if (tenantsError) console.error('Error tenants:', tenantsError);
  else console.log('Tenants:', JSON.stringify(tenants, null, 2));

  const { data: agents, error: agentsError } = await supabase.from('ai_agents').select('id, name, tenant_id');
  if (agentsError) console.error('Error agents:', agentsError);
  else console.log('AI Agents:', JSON.stringify(agents, null, 2));
}

main();
