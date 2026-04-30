
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log("Starting migration: Adding knowledge_base_ids to ai_agent_variants...");
  
  // Try to use rpc if run_sql is enabled, or just perform a query to see if column exists
  // Since we can't easily run arbitrary SQL via supabase-js without an RPC, 
  // we will just rely on the UI update to handle the data if the column is added manually or via psql if available.
  
  // NOTE: In many cases, adding a column requires SQL access. 
  // I will try to use a common RPC 'exec_sql' if it exists.
  
  const { error } = await supabase.rpc('exec_sql', {
    query: "ALTER TABLE ai_agent_variants ADD COLUMN IF NOT EXISTS knowledge_base_ids text[] DEFAULT '{}';"
  });

  if (error) {
    console.error("Migration failed via RPC 'exec_sql':", error.message);
    console.log("Checking if column already exists...");
    
    const { data, error: selectError } = await supabase
      .from('ai_agent_variants')
      .select('knowledge_base_ids')
      .limit(1);
      
    if (selectError) {
      console.error("Column knowledge_base_ids does NOT exist.");
      console.log("ACTION REQUIRED: Run this SQL in your Supabase Dashboard:");
      console.log("ALTER TABLE ai_agent_variants ADD COLUMN knowledge_base_ids text[] DEFAULT '{}';");
    } else {
      console.log("Column knowledge_base_ids already exists. No action needed.");
    }
  } else {
    console.log("Migration successful via RPC!");
  }
}

runMigration();
