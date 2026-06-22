import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function fixAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!serviceKey || !url) {
    console.error("Missing credentials");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  console.log("Fetching users...");
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error("Error fetching users", usersError);
    return;
  }

  for (const user of users.users) {
    console.log(`Updating user ${user.email}...`);
    await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { is_admin: true }
    });
  }

  console.log("Updating tenants table...");
  // Update all tenants to have is_admin: true in config if they don't
  const { data: tenants } = await supabase.from("tenants").select("*");
  for (const t of tenants || []) {
    const config = t.config || {};
    config.is_admin = true;
    await supabase.from("tenants").update({ config }).eq("id", t.id);
  }

  console.log("Admin access restored!");
}

fixAdmin();
