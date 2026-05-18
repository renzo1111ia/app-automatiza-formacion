import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name');

  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('ALL TENANTS IN DATABASE:');
  console.log(JSON.stringify(tenants, null, 2));
}

main();
