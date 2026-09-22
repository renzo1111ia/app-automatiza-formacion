import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const targetEmail = process.argv[2] || "admin@test.com";

const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log(`🔍 Buscando usuario ${targetEmail} en Supabase Auth...`);
  const { data: list, error: listError } = await admin.auth.admin.listUsers();

  if (listError) {
    console.error("❌ Error listando usuarios:", listError.message);
    process.exit(1);
  }

  const existing = list?.users?.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());

  if (existing) {
    console.log(`✅ Usuario encontrado (ID: ${existing.id}). Actualizando a Super Admin...`);
    const currentMeta = existing.app_metadata || {};
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: {
        ...currentMeta,
        is_super_admin: true,
        is_admin: true,
        admin: true,
      },
    });

    if (error) {
      console.error("❌ Error actualizando app_metadata:", error.message);
    } else {
      console.log(`🎉 ¡ÉXITO! ${targetEmail} ahora tiene privilegios de SUPER ADMIN developer.`);
      console.log(`   - Acceso a /dashboard/super-admin habilitado.`);
      console.log(`   - Visión y control de todos los clientes (tenants) habilitado.`);
    }
  } else {
    console.log(`⚠️ No se encontró ningún usuario registrado con el email ${targetEmail}`);
    console.log(`   Puedes registrar el usuario primero desde /login o vía el panel Supabase.`);
  }
}

main().catch(console.error);
