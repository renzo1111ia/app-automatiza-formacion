import { getInboxLeads, getAgentTrackedVariables } from '../lib/actions/inbox';
import { getActiveTenantConfig } from '../lib/actions/tenant';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Since cookies() isn't available, we will mock getActiveTenantConfig
// to return Esden Business School tenant if it's imported inside the action.
// Let's print out what is returned by the direct database queries first.

import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Fetch tenant
  const { data: tenant } = await supabase.from('tenants').select('*').limit(1).single();
  console.log('Active Tenant ID in DB:', tenant?.id);

  // Directly fetch lead Renzo
  const { data: renzo } = await supabase.from('lead').select('*').eq('nombre', 'Renzo').single();
  console.log('Renzo metadata in DB:', JSON.stringify(renzo?.metadata, null, 2));

  // Directly fetch active agent variant for tenant
  const { data: variant } = await supabase
    .from('ai_agent_variants')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  console.log('Active variant tracked_variables:', JSON.stringify(variant?.tracked_variables, null, 2));
}

main();
