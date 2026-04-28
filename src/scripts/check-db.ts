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
  
  const { data: tenants, error: tenantsError } = await supabase.from('tenants').select('id, name, config');
  if (tenantsError) console.error('Error tenants:', tenantsError);
  else console.log('Tenants:', JSON.stringify(tenants, null, 2));

  const { data: variants, error: variantsError } = await supabase.from('ai_agent_variants').select('agent_id, name, is_active, tracked_variables').eq('is_active', true);
  if (variantsError) console.error('Error variants:', variantsError);
  else console.log('Active Variants:', JSON.stringify(variants, null, 2));

  const { data: leads, error: leadsError } = await supabase.from('lead').select('id, nombre, apellido, metadata').order('fecha_creacion', { ascending: false }).limit(3);
  if (leadsError) console.error('Error leads:', leadsError);
  else console.log('Recent Leads Metadata:', JSON.stringify(leads, null, 2));
}

main();
