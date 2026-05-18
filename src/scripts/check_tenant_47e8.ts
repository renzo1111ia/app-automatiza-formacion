import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Fetch tenant by the ID in browser logs
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', '47e84fa2-73f3-4e23-9267-1e49d4442f70')
    .maybeSingle();

  if (error) {
    console.error('Error fetching tenant:', error);
    return;
  }
  
  console.log('Tenant 47e8...:', JSON.stringify(tenant, null, 2));

  // Check if there are leads under this tenant
  const { data: leads } = await supabase
    .from('lead')
    .select('id, nombre, apellido, metadata')
    .eq('tenant_id', '47e84fa2-73f3-4e23-9267-1e49d4442f70');
  console.log('Leads under this tenant:', JSON.stringify(leads, null, 2));
}

main();
