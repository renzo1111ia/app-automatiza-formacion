import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const tenantId = '47e84fa2-73f3-4e23-9267-1e49d4442f70'; // esden
  
  // Fetch active variant
  const { data: variants, error: fetchError } = await supabase
    .from('ai_agent_variants')
    .select('id, version_label, tracked_variables')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
    
  if (fetchError || !variants || variants.length === 0) {
    console.error('Error fetching active variants:', fetchError);
    return;
  }
  
  const variant = variants[0];
  console.log('Current variant:', variant.id, variant.version_label);
  console.log('Current tracked_variables:', variant.tracked_variables);
  
  // Clean tracked_variables:
  // Remove YEARS_EXPERIENCIE, USER_ESTUDIES
  const originalList: string[] = variant.tracked_variables || [];
  const cleanedList = originalList.filter(
    v => v !== 'YEARS_EXPERIENCIE' && v !== 'USER_ESTUDIES'
  );
  
  // Deduplicate just in case
  const uniqueList = Array.from(new Set(cleanedList)).sort();
  
  console.log('Cleaned unique tracked_variables:', uniqueList);
  
  // Update database
  const { error: updateError } = await supabase
    .from('ai_agent_variants')
    .update({ tracked_variables: uniqueList })
    .eq('id', variant.id);
    
  if (updateError) {
    console.error('Error updating variant:', updateError);
  } else {
    console.log('Successfully updated agent variant tracked_variables in database!');
  }
}

main();
