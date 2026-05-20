/**
 * Seed demo — dashboard-af
 *
 * Genera datos ficticios para desarrollo local contra Supabase self-hosted.
 * NO usar contra produccion ni Supabase remoto del cliente.
 *
 * Uso:
 *   npx tsx scripts/seed-demo.ts
 *
 * Requisitos:
 *   - Supabase local corriendo (npx supabase start)
 *   - .env.local con NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - Migraciones aplicadas (las aplica supabase start automaticamente)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[seed-demo] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const NOMBRES = ["Carlos", "Maria", "Javier", "Ana", "Luis", "Carmen", "Miguel", "Laura", "Antonio", "Elena", "Jose", "Cristina", "Manuel", "Patricia", "Francisco"];
const APELLIDOS = ["Garcia", "Rodriguez", "Martinez", "Lopez", "Sanchez", "Gonzalez", "Fernandez", "Perez", "Martin", "Ruiz", "Hernandez", "Jimenez"];
const PAISES = ["ES", "MX", "AR", "CO", "CL", "PE"];
const ORIGENES = ["facebook_ads", "google_ads", "organico_web", "referido", "instagram_ads", "linkedin_ads"];
const TIPOS_LEAD = ["frio", "templado", "caliente", "muy_caliente"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function phone(): string {
    const n = Math.floor(600000000 + Math.random() * 99999999);
    return `+34 ${n}`;
}
function daysAgo(d: number): string {
    return new Date(Date.now() - d * 86400000).toISOString();
}

async function main() {
    console.log("[seed-demo] Iniciando seed contra", SUPABASE_URL);

    // ---------- 1. Tenant demo ----------
    console.log("[seed-demo] Creando tenant demo...");
    const { data: existingTenant } = await admin
        .from("tenants")
        .select("id")
        .eq("name", "Academia AF Demo")
        .maybeSingle();

    let tenantId: string;
    if (existingTenant) {
        tenantId = existingTenant.id;
        console.log("  -> tenant ya existe, id:", tenantId);
    } else {
        const { data, error } = await admin
            .from("tenants")
            .insert({
                name: "Academia AF Demo",
                supabase_url: SUPABASE_URL,
                supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "demo-key",
                client_email: "demo@af.local",
                config: {
                    headers: [],
                    dashboard_title: "Academia AF — Dashboard Demo",
                    primary_color: "#4f46e5",
                },
            })
            .select("id")
            .single();
        if (error) { console.error("  FAIL tenant:", error.message); process.exit(1); }
        tenantId = data.id;
        console.log("  -> tenant creado, id:", tenantId);
    }

    // ---------- 2. Usuario admin demo ----------
    console.log("[seed-demo] Creando usuario admin demo...");
    const email = "demo@af.local";
    const password = "DemoPassword123!";
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { is_admin: true, tenant_id: tenantId, full_name: "Demo Admin" },
    });
    if (userErr && !userErr.message.includes("already")) {
        console.error("  FAIL user:", userErr.message);
    } else {
        console.log(`  -> usuario: ${email} / ${password}`);
        if (userData?.user?.id) {
            await admin.from("tenants").update({ auth_user_id: userData.user.id }).eq("id", tenantId);
        }
    }

    // ---------- 3. Programas formativos ----------
    console.log("[seed-demo] Creando programas...");
    const programas = [
        { nombre: "Master IA Aplicada", precio: 4900, duracion_meses: 9 },
        { nombre: "Bootcamp Full-Stack", precio: 3500, duracion_meses: 6 },
        { nombre: "Curso Marketing Digital", precio: 1200, duracion_meses: 3 },
    ];
    const programIds: string[] = [];
    for (const p of programas) {
        const { data, error } = await admin
            .from("programas")
            .insert({ tenant_id: tenantId, ...p })
            .select("id")
            .single();
        if (!error && data) programIds.push(data.id);
        else if (error) console.log("  programas insert error (puede ser ok si tabla difiere):", error.message);
    }
    console.log(`  -> ${programIds.length} programas creados`);

    // ---------- 4. Leads ficticios ----------
    console.log("[seed-demo] Creando 15 leads...");
    const leads = Array.from({ length: 15 }, (_, i) => ({
        tenant_id: tenantId,
        id_lead_externo: `DEMO-${1000 + i}`,
        nombre: pick(NOMBRES),
        apellido: pick(APELLIDOS),
        telefono: phone(),
        email: `lead${i}@demo.af.local`,
        pais: pick(PAISES),
        tipo_lead: pick(TIPOS_LEAD),
        origen: pick(ORIGENES),
        campana: `Campana ${pick(["Q1", "Q2", "Q3", "Q4"])} 2026`,
        fecha_ingreso_crm: daysAgo(Math.floor(Math.random() * 60)),
    }));
    const { data: leadsInserted, error: leadsErr } = await admin
        .from("lead")
        .insert(leads)
        .select("id");
    if (leadsErr) console.error("  FAIL leads:", leadsErr.message);
    else console.log(`  -> ${leadsInserted?.length ?? 0} leads creados`);

    // ---------- 5. Llamadas ----------
    if (leadsInserted && leadsInserted.length > 0) {
        console.log("[seed-demo] Creando 8 llamadas demo...");
        const llamadas = Array.from({ length: 8 }, (_, i) => ({
            tenant_id: tenantId,
            id_lead: leadsInserted[i % leadsInserted.length].id,
            tipo_agente: pick(["ia", "humano"]),
            nombre_agente: pick(["Virginia IA", "Carlos Asesor", "Maria IA", "Pedro Asesor"]),
            estado_llamada: pick(["completada", "no_contestada", "buzon", "rechazada"]),
            razon_termino: pick(["finalizada_ok", "no_contesta", "rechaza", "buzon_voz"]),
        }));
        const { error } = await admin.from("llamadas").insert(llamadas);
        if (error) console.error("  FAIL llamadas:", error.message);
        else console.log("  -> 8 llamadas creadas");
    }

    // ---------- 6. Campanas ----------
    console.log("[seed-demo] Creando campanas...");
    const { error: campErr } = await admin.from("campanas").insert([
        { tenant_id: tenantId, nombre: "Black Friday 2026", activa: true },
        { tenant_id: tenantId, nombre: "Nuevo Curso IA", activa: true },
    ]);
    if (campErr) console.log("  campanas insert (puede ok si tabla difiere):", campErr.message);

    console.log("\n[seed-demo] Seed completado.");
    console.log("  Login: demo@af.local / DemoPassword123!");
    console.log("  Tenant:", tenantId);
}

main().catch((err) => {
    console.error("[seed-demo] error inesperado:", err);
    process.exit(1);
});
