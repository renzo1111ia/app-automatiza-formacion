import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
  const { data: logs, error } = await supabase
    .from('system_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching logs:", error);
  } else {
    console.log("Latest Logs:", JSON.stringify(logs, null, 2));
  }

  const { data: messages, error: msgError } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (msgError) {
    console.error("Error fetching chat_messages:", msgError);
  } else {
    console.log("Latest Messages:", JSON.stringify(messages, null, 2));
  }
}

checkLogs();
