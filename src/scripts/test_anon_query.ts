import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function main() {
  console.log('Querying Supabase with PUBLIC ANON KEY...');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: leads, error } = await supabase
    .from('lead')
    .select('id, nombre, apellido, metadata');
  
  if (error) {
    console.error('Error fetching leads with anon key:', error);
  } else {
    console.log('Leads fetched with anon key:', JSON.stringify(leads, null, 2));
  }
}

main();
