import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: leads, error } = await supabase
    .from('lead')
    .select('id, nombre, apellido, telefono, metadata, fecha_creacion');
  
  if (error) console.error(error);
  else console.log('All Leads:', JSON.stringify(leads, null, 2));
}

main();
