import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const tenantId = '47e84fa2-73f3-4e23-9267-1e49d4442f70'; // esden
  
  const { data: advisors } = await supabase
    .from('advisors')
    .select('*')
    .eq('tenant_id', tenantId);
  console.log('ADVISORS FOR ESDEN:');
  console.log(JSON.stringify(advisors, null, 2));
}

main();
