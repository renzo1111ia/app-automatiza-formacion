import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const tenantId = '47e84fa2-73f3-4e23-9267-1e49d4442f70'; // esden tenant ID

  // 1. Get current tenant config
  const { data: tenant, error: fetchErr } = await supabase
    .from('tenants')
    .select('config')
    .eq('id', tenantId)
    .single();

  if (fetchErr || !tenant) {
    console.error('Error fetching tenant config:', fetchErr);
    return;
  }

  const config = tenant.config as any;
  if (!config || !config.kpis) {
    console.error('No KPIs configuration found in tenant config.');
    return;
  }

  console.log('Original KPIs configuration:');
  console.log(JSON.stringify(config.kpis, null, 2));

  // 2. Modify def-1 staticKey to "total_leads_sistema"
  let updated = false;
  config.kpis = config.kpis.map((kpi: any) => {
    if (kpi.id === 'def-1') {
      console.log(`Modifying KPI ${kpi.id} ("${kpi.label}") from "${kpi.staticKey}" to "total_leads_sistema"`);
      kpi.staticKey = 'total_leads_sistema';
      updated = true;
    }
    return kpi;
  });

  if (!updated) {
    console.log('KPI with ID "def-1" not found or not updated.');
    return;
  }

  // 3. Update tenant config in the database
  const { data, error: updateErr } = await supabase
    .from('tenants')
    .update({ config })
    .eq('id', tenantId)
    .select();

  if (updateErr) {
    console.error('Error updating tenant config:', updateErr);
  } else {
    console.log('Tenant KPI configuration updated successfully!');
    console.log(JSON.stringify(data?.[0]?.config?.kpis, null, 2));
  }
}

main();
