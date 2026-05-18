import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createDemoUser() {
    console.log("📝  Creando usuario demo...");

    const email = "demo@esden.com";
    const password = "demoPassword123!";

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirmamos el correo para que pueda iniciar sesión directamente
        user_metadata: {
            is_admin: true
        }
    });

    if (error) {
        console.error("❌  Error al crear el usuario demo:");
        console.error(error.message);
        process.exit(1);
    }

    console.log("✅  Usuario demo creado exitosamente:");
    console.log(`    📧  Email      : ${email}`);
    console.log(`    🔑  Contraseña : ${password}`);
    console.log(`    🆔  User ID    : ${data.user.id}`);
    console.log("\n🚀  Ya puedes iniciar sesión en http://localhost:3000 con estas credenciales.");
}

createDemoUser();
