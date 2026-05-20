import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: tenants, error } = await supabase.from('tenants').select('*');
  if (error) {
    console.error('Error fetching tenants:', error);
    return;
  }
  for (const tenant of tenants) {
    console.log(`Tenant: ${tenant.name} (${tenant.id})`);
    console.log('KPIS:');
    console.log(JSON.stringify(tenant.config?.kpis, null, 2));
    console.log('FUNNEL:');
    console.log(JSON.stringify(tenant.config?.funnel, null, 2));
  }
}

main();
