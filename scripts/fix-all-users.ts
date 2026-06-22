import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function fixAllUsers() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  const supabase = createClient(url!, serviceKey!);

  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error);
    return;
  }

  for (const user of users.users) {
    console.log(`Updating ${user.email}...`);
    await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, is_admin: true }
    });
  }
  console.log("Done updating all users.");
}
fixAllUsers();
