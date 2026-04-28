import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('--- AI_AGENT_VARIANTS COLUMNS CHECK ---');
  const { data: variant, error: variantError } = await supabase
    .from('ai_agent_variants')
    .select('*')
    .limit(1);
  
  if (variantError) console.error('Error variant:', variantError);
  else if (variant && variant[0]) console.log('Variant columns:', Object.keys(variant[0]));
}

main();
