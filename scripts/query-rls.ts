import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function queryRls() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  const supabase = createClient(url!, serviceKey!);

  // We can just execute a query using postgres extension or similar, but via pg is better.
  // Actually we can use the `postgres` package which is in package.json
  const postgres = require("postgres");
  const sql = postgres(process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:8200/postgres");
  const policies = await sql`SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'tenants'`;
  console.log(policies);
  process.exit(0);
}
queryRls();
