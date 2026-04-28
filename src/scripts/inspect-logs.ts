import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('--- SYSTEM LOGS ---');
  const { data: logs, error: logsError } = await supabase
    .from('system_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (logsError) console.error('Error logs:', logsError);
  else console.log(JSON.stringify(logs, null, 2));

  console.log('--- LEAD COLUMNS CHECK ---');
  const { data: lead, error: leadError } = await supabase
    .from('lead')
    .select('*')
    .limit(1);
  
  if (leadError) console.error('Error lead:', leadError);
  else if (lead && lead[0]) console.log('Lead columns:', Object.keys(lead[0]));
}

main();
