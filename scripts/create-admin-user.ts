import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log("Uso: npx tsx scripts/create-admin-user.ts <email> <password>");
  process.exit(1);
}

async function main() {
  console.log(`🔐 Configurando usuario de producción: ${email}...`);

  // 1. Verificar si ya existe
  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) {
    console.error("❌ Error consultando usuarios:", listError.message);
    process.exit(1);
  }

  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    console.log(
      `🔄 El usuario ya existe (ID: ${existing.id}). Actualizando contraseña y permisos Super Admin...`
    );
    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: {
        ...existing.app_metadata,
        is_super_admin: true,
        is_admin: true,
        admin: true,
      },
    });

    if (updateError) {
      console.error("❌ Error al actualizar:", updateError.message);
      process.exit(1);
    }
    console.log(`✅ ¡Contraseña actualizada y permisos de Super Admin activados para ${email}!`);
  } else {
    console.log(`✨ Creando nuevo usuario Super Admin...`);
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        is_super_admin: true,
        is_admin: true,
        admin: true,
      },
      user_metadata: {
        full_name: "Super Admin",
      },
    });

    if (createError) {
      console.error("❌ Error al crear usuario:", createError.message);
      process.exit(1);
    }
    console.log(`🎉 ¡Usuario creado exitosamente con ID: ${newUser.user?.id}!`);
  }

  console.log("\n🚀 Ahora puedes iniciar sesión en el dashboard con:");
  console.log(`   Email: ${email}`);
  console.log(`   Contraseña: ${password}`);
}

main().catch(console.error);
