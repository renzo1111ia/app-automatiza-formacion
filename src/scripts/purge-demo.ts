"use server";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { requireEnv, requireEnvAny } from "@/lib/env";

dotenv.config();

// Sprint 0 tarea 1-04: sin fallback hardcoded. Si las env vars faltan, el script
// falla con mensaje claro en lugar de conectar a un host inseguro.
const url = requireEnvAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(url, key);

async function cleanAllDemoData() {
  console.log("🧹 Purgando absolutamente todos los datos de laboratorio...");

  // 1. Purgar leads demo
  const { count: lCount, error: lErr } = await supabase
    .from("lead")
    .delete({ count: "exact" })
    .eq("origen", "LAB DEMO");

  if (lErr) console.error("Error Leads:", lErr.message);
  else console.log(`Leads eliminados: ${lCount}`);

  // 2. Purgar campañas demo
  const { count: cCount, error: cErr } = await supabase
    .from("campanas")
    .delete({ count: "exact" })
    .like("nombre", "Lab Demo%");

  if (cErr) console.error("Error Campañas:", cErr.message);
  else console.log(`Campañas eliminadas: ${cCount}`);

  console.log("✨ Sistema limpio y listo para producción.");
}

cleanAllDemoData();
