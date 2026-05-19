import { getAdminSupabaseClient } from '../lib/supabase/server';

async function main() {
  const supabase = await getAdminSupabaseClient();
  const { data: leads, error } = await supabase
    .from('lead')
    .select('*')
    .ilike('nombre', '%renzo%');
  
  if (error) {
    console.error('Error fetching lead:', error);
    return;
  }
  
  console.log('Found Renzo leads:', JSON.stringify(leads, null, 2));
}

main();
