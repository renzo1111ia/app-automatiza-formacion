import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function migrateWaba() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!serviceKey || !url) {
    console.error("Missing credentials");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  console.log("Fetching tenants...");
  const { data: tenants, error } = await supabase.from("tenants").select("id, config");
  if (error) {
    console.error("Error fetching tenants:", error);
    return;
  }

  for (const t of tenants || []) {
    const wa = t.config?.whatsapp;
    if (wa && wa.wabaId && wa.accessToken) {
      console.log(`Migrating tenant ${t.id}...`);
      
      const { data: existing } = await supabase
        .from("waba_configurations")
        .select("id")
        .eq("tenant_id", t.id)
        .maybeSingle();

      if (!existing) {
        console.log(`Inserting waba config for tenant ${t.id}...`);
        await supabase.from("waba_configurations").insert({
          tenant_id: t.id,
          waba_id: wa.wabaId,
          phone_number_id: wa.phoneNumberId,
          access_token: wa.accessToken,
          webhook_verify_token: wa.verifyToken,
          is_active: true
        });
      }
    }
  }

  console.log("Migration complete!");
}

migrateWaba();
