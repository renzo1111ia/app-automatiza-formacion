/**
 * Test programatico de login para diagnosticar problemas auth.
 * Uso: npx tsx scripts/test-login.ts [email] [password]
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const email = process.argv[2] ?? "viewer@af.local";
const password = process.argv[3] ?? "2Pg83baBaz9T6UjG0X9o-Aa1!";

async function main() {
    const client = createClient(url, anonKey);

    // Intento login real
    console.log(`\nIntentando login con: ${email}`);
    console.log(`Password (chars: ${password.length}): ${password}`);

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
        console.log(`\n❌ LOGIN FALLIDO: ${error.message}`);
        console.log(`   Status: ${error.status}`);

        // Verifica si el usuario existe
        const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
        const { data: users } = await admin.auth.admin.listUsers();
        const found = users?.users?.find((u) => u.email === email);
        if (!found) {
            console.log(`   El usuario ${email} NO existe en auth.users`);
        } else {
            console.log(`   Usuario existe (id: ${found.id})`);
            console.log(`   user_metadata: ${JSON.stringify(found.user_metadata)}`);
            console.log(`   email_confirmed_at: ${found.email_confirmed_at}`);
            console.log(`   -> Si existe pero login falla, la PASSWORD es incorrecta.`);
            console.log(`   -> Ejecuta 'npx tsx scripts/show-demo-credentials.ts' para regenerar.`);
        }
    } else {
        console.log(`\n✅ LOGIN OK`);
        console.log(`   user_id: ${data.user?.id}`);
        console.log(`   email: ${data.user?.email}`);
        console.log(`   user_metadata: ${JSON.stringify(data.user?.user_metadata)}`);
        console.log(`   is_admin: ${data.user?.user_metadata?.is_admin}`);
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
