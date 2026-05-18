/**
 * ESDEN Analytics Dashboard — Seed Script (PRODUCCIÓN)
 * ========================================
 * Este script ya no genera datos para la tabla deprecada.
 * Se debe actualizar para generar datos en las 9 tablas normalizadas
 * si se desea realizar pruebas de integración.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌  Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

// const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
    console.log(`\n🌱  ESDEN Seed — Tabla de análisis DEPRECADA.\n`);
    console.log(`\n⚠️  El seed debe ser actualizado para las 9 tablas normalizadas.\n`);
}

seed().catch((err) => {
    console.error("❌  Unexpected error:", err);
    process.exit(1);
});
