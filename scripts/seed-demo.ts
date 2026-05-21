/**
 * Seed demo — dashboard-af
 *
 * Genera datos ficticios abundantes para desarrollo local contra Supabase
 * self-hosted (puerto 8100). NO usar contra Supabase del cliente.
 *
 * Lee credenciales del demo user desde .env.local (DEMO_USER_EMAIL +
 * DEMO_USER_PASSWORD). La password es generada con crypto al crear .env.local.
 *
 * Uso:
 *   npx tsx scripts/seed-demo.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@af.local";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[seed-demo] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 16) {
    console.error("[seed-demo] DEMO_USER_PASSWORD must be at least 16 chars in .env.local");
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- Catalogos ----------
const NOMBRES = ["Carlos", "Maria", "Javier", "Ana", "Luis", "Carmen", "Miguel", "Laura", "Antonio", "Elena", "Jose", "Cristina", "Manuel", "Patricia", "Francisco", "Lucia", "David", "Isabel", "Pedro", "Sofia"];
const APELLIDOS = ["Garcia", "Rodriguez", "Martinez", "Lopez", "Sanchez", "Gonzalez", "Fernandez", "Perez", "Martin", "Ruiz", "Hernandez", "Jimenez", "Diaz", "Moreno", "Alvarez", "Romero", "Alonso", "Gutierrez"];
const PAISES = ["Spain", "Mexico", "Argentina", "Colombia", "Chile", "Peru", "Ecuador", "Uruguay"];
const ORIGENES = ["facebook_ads", "google_ads", "organico_web", "referido", "instagram_ads", "linkedin_ads", "tiktok_ads"];
const TIPOS_LEAD = ["frio", "templado", "caliente", "muy_caliente"];
const STATUS_LEAD = ["PENDING", "CONTACTED", "QUALIFIED", "ENROLLED", "REJECTED"];
const ADVISORS_NOMBRES = ["Patricia Asesor", "Carlos Asesor", "Maria Asesor", "Javier Asesor"];
const PROGRAMAS = [
    { name: "Master IA Aplicada", category: "Tecnologia", precio: 4900, duracion_meses: 9 },
    { name: "Bootcamp Full-Stack Developer", category: "Desarrollo", precio: 3500, duracion_meses: 6 },
    { name: "Curso Marketing Digital", category: "Marketing", precio: 1200, duracion_meses: 3 },
    { name: "Master Ciencia de Datos", category: "Tecnologia", precio: 5500, duracion_meses: 10 },
    { name: "Programa Cybersecurity", category: "Seguridad", precio: 4200, duracion_meses: 8 },
    { name: "Diploma UX/UI Design", category: "Diseño", precio: 2800, duracion_meses: 5 },
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function phone(country: string): string {
    const prefijos: Record<string, string> = { Spain: "+34", Mexico: "+52", Argentina: "+54", Colombia: "+57", Chile: "+56", Peru: "+51", Ecuador: "+593", Uruguay: "+598" };
    return `${prefijos[country] ?? "+34"} ${rand(600000000, 999999999)}`;
}
function daysAgo(d: number): string {
    return new Date(Date.now() - d * 86400000).toISOString();
}
function daysFromNow(d: number): string {
    return new Date(Date.now() + d * 86400000).toISOString();
}

async function clearExistingDemo(tenantId: string) {
    // limpia cualquier rastro previo para que el seed sea idempotente
    const tables = ["chat_messages", "conversaciones_whatsapp", "llamadas", "intentos_llamadas", "intentos", "notificaciones", "lead_cualificacion", "lead_programas", "appointments", "lead", "campanas", "programas", "advisors", "voice_agents", "ai_agent_variants", "ai_agents"];
    for (const t of tables) {
        await admin.from(t).delete().eq("tenant_id", tenantId);
    }
}

async function main() {
    console.log(`[seed-demo] Supabase: ${SUPABASE_URL}`);

    // ---------- 1. Tenant ----------
    console.log("[1] Tenant demo...");
    let tenantId: string;
    const { data: existingTenant } = await admin.from("tenants").select("id").eq("name", "Academia AF Demo").maybeSingle();
    if (existingTenant) {
        tenantId = existingTenant.id;
        console.log(`    -> tenant existente: ${tenantId}`);
        await clearExistingDemo(tenantId);
    } else {
        const { data, error } = await admin.from("tenants").insert({
            name: "Academia AF Demo",
            supabase_url: SUPABASE_URL,
            supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "demo-key",
            client_email: DEMO_EMAIL,
            config: { headers: [], dashboard_title: "Academia AF — Dashboard Demo", primary_color: "#4f46e5" },
        }).select("id").single();
        if (error) { console.error("    FAIL:", error.message); process.exit(1); }
        tenantId = data.id;
        console.log(`    -> tenant creado: ${tenantId}`);
    }

    // ---------- 2. Usuario admin ----------
    console.log("[2] Usuario admin...");
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { is_admin: true, tenant_id: tenantId, full_name: "Demo Admin" },
    });
    if (userErr && !userErr.message.toLowerCase().includes("already")) {
        console.error("    FAIL:", userErr.message);
    } else {
        console.log(`    -> ${DEMO_EMAIL} (password en .env.local)`);
        if (userData?.user?.id) {
            await admin.from("tenants").update({ auth_user_id: userData.user.id }).eq("id", tenantId);
        }
    }

    // ---------- 3. Advisors ----------
    console.log("[3] Advisors...");
    const { data: advisors } = await admin.from("advisors").insert(
        ADVISORS_NOMBRES.map((n) => ({
            tenant_id: tenantId,
            name: n,
            email: `${n.toLowerCase().replace(/\s+/g, ".")}@af.local`,
            phone: phone("Spain"),
            is_active: true,
            origins: ["facebook_ads", "google_ads"],
            campaigns: ["Q1 2026"],
            countries: ["ES", "MX"],
            courses: ["Master IA", "Bootcamp"],
        }))
    ).select("id, name");
    console.log(`    -> ${advisors?.length ?? 0} advisors`);

    // ---------- 4. Programas ----------
    console.log("[4] Programas...");
    const { data: programas } = await admin.from("programas").insert(
        PROGRAMAS.map((p) => ({ tenant_id: tenantId, ...p, activo: true }))
    ).select("id, name");
    console.log(`    -> ${programas?.length ?? 0} programas`);

    // ---------- 5. Campanas ----------
    console.log("[5] Campanas...");
    const campanas = [
        { nombre: "Black Friday 2026", activa: true, fecha_inicio: daysAgo(15) },
        { nombre: "Nuevo Curso IA", activa: true, fecha_inicio: daysAgo(30) },
        { nombre: "Beca Latam 2026", activa: true, fecha_inicio: daysAgo(45) },
        { nombre: "Open Day Marketing", activa: false, fecha_inicio: daysAgo(90) },
    ];
    const { data: campanasIns } = await admin.from("campanas").insert(campanas.map((c) => ({ tenant_id: tenantId, ...c }))).select("id, nombre");
    console.log(`    -> ${campanasIns?.length ?? 0} campanas`);

    // ---------- 6. AI Agents + Variants ----------
    console.log("[6] AI Agents...");
    const { data: aiAgents } = await admin.from("ai_agents").insert([
        { tenant_id: tenantId, name: "Virginia (Cualificacion)", type: "QUALIFY", status: "ACTIVE", description: "Agente IA principal de cualificacion de leads" },
        { tenant_id: tenantId, name: "Sofia (Followup)", type: "FOLLOWUP", status: "ACTIVE", description: "Agente IA de seguimiento post-llamada" },
    ]).select("id, name");
    if (aiAgents && aiAgents.length > 0) {
        await admin.from("ai_agent_variants").insert(aiAgents.map((a) => ({
            agent_id: a.id,
            tenant_id: tenantId,
            version_label: "v1.0",
            prompt_text: `Prompt placeholder para ${a.name}. EDITAR en Studio.`,
            is_active: true,
            model_provider: "openai",
            model_name: "gpt-4.1-mini",
        })));
    }
    console.log(`    -> ${aiAgents?.length ?? 0} AI agents + variants`);

    // ---------- 7. Voice Agents ----------
    console.log("[7] Voice Agents...");
    const { data: voiceAgents } = await admin.from("voice_agents").insert([
        { tenant_id: tenantId, name: "Maria (Voice Demo)", status: "ACTIVE", provider: "RETELL", provider_agent_id: "agent_demo_local", voice_id: "voice_demo", from_number: "+34900000001", prompt_text_retell: "Voice prompt placeholder. EDITAR en Studio." },
    ]).select("id, name");
    console.log(`    -> ${voiceAgents?.length ?? 0} voice agents`);

    // ---------- 8. Leads (40) ----------
    console.log("[8] Leads (40)...");
    const advisorIds = (advisors ?? []).map((a) => a.id);
    const leadsRaw = Array.from({ length: 40 }, (_, i) => {
        const pais = pick(PAISES);
        const nombre = pick(NOMBRES);
        const apellido = pick(APELLIDOS);
        return {
            tenant_id: tenantId,
            id_lead_externo: `DEMO-${1000 + i}`,
            nombre,
            apellido,
            telefono: phone(pais),
            email: `${nombre.toLowerCase()}.${apellido.toLowerCase()}.${i}@demo.af.local`,
            pais,
            tipo_lead: pick(TIPOS_LEAD),
            origen: pick(ORIGENES),
            campana: pick(campanas).nombre,
            status: pick(STATUS_LEAD),
            is_ai_enabled: Math.random() > 0.2,
            advisor_id: advisorIds.length > 0 && Math.random() > 0.3 ? pick(advisorIds) : null,
            metadata: { USER_NAME: nombre, demo: true },
            fecha_ingreso_crm: daysAgo(rand(0, 90)),
        };
    });
    const { data: leads, error: leadsErr } = await admin.from("lead").insert(leadsRaw).select("id");
    if (leadsErr) { console.error("    FAIL:", leadsErr.message); }
    console.log(`    -> ${leads?.length ?? 0} leads`);

    if (!leads || leads.length === 0) {
        console.log("[seed-demo] Sin leads, terminando.");
        process.exit(0);
    }

    // ---------- 9. Lead-Programas (relacion) ----------
    if (programas && programas.length > 0) {
        console.log("[9] Lead-Programas...");
        const lp = leads.slice(0, 25).map((l) => ({
            tenant_id: tenantId,
            id_lead: l.id,
            id_programa: pick(programas).id,
            estado: pick(["INTERESADO", "INSCRITO", "MATRICULADO", "DESCARTADO"]),
        }));
        await admin.from("lead_programas").insert(lp);
        console.log(`    -> ${lp.length} relaciones lead-programa`);
    }

    // ---------- 10. Lead Cualificacion ----------
    console.log("[10] Cualificaciones...");
    const cualifs = leads.slice(0, 30).map((l) => ({
        tenant_id: tenantId,
        id_lead: l.id,
        score: rand(20, 95),
        nivel: pick(["A", "B", "C", "D"]),
        observaciones: pick([
            "Lead muy interesado, solicita info de financiacion.",
            "Pidio info de precios y becas.",
            "Inscripcion pendiente de confirmacion.",
            "Lead frio, no responde mensajes.",
            "Interes confirmado en programa.",
        ]),
        razones: ["interes_alto", "presupuesto_disponible"],
        cualificado_por: "Virginia IA",
    }));
    await admin.from("lead_cualificacion").insert(cualifs);
    console.log(`    -> ${cualifs.length} cualificaciones`);

    // ---------- 11. Llamadas ----------
    console.log("[11] Llamadas...");
    const llamadas = leads.slice(0, 30).flatMap((l, i) => Array.from({ length: rand(1, 3) }, () => ({
        tenant_id: tenantId,
        id_lead: l.id,
        id_llamada_retell: `call_demo_${i}_${Math.random().toString(36).slice(2, 8)}`,
        tipo_agente: pick(["ia", "humano"]),
        nombre_agente: pick(["Virginia IA", ...ADVISORS_NOMBRES]),
        estado_llamada: pick(["completada", "no_contestada", "buzon", "rechazada", "en_curso"]),
        razon_termino: pick(["finalizada_ok", "no_contesta", "rechaza", "buzon_voz", "agendamiento"]),
        duracion_segundos: rand(15, 600),
    })));
    await admin.from("llamadas").insert(llamadas);
    console.log(`    -> ${llamadas.length} llamadas`);

    // ---------- 12. Conversaciones WhatsApp + Messages ----------
    console.log("[12] Conversaciones WhatsApp...");
    const conversaciones = leads.slice(0, 20).map((l) => ({
        tenant_id: tenantId,
        id_lead: l.id,
        fecha_inicio: daysAgo(rand(0, 30)),
        fecha_ultimo_mensaje: daysAgo(rand(0, 5)),
        estado: pick(["ACTIVA", "CERRADA", "PENDIENTE"]),
    }));
    await admin.from("conversaciones_whatsapp").insert(conversaciones);

    // Y chat_messages (whatsapp inbox)
    const messages = leads.slice(0, 20).flatMap((l) => {
        const numMessages = rand(3, 8);
        return Array.from({ length: numMessages }, (_, i) => ({
            tenant_id: tenantId,
            lead_id: l.id,
            direction: i % 2 === 0 ? "INBOUND" : "OUTBOUND",
            message_type: "TEXT",
            content: pick([
                "Hola, me interesa el master de IA",
                "¿Cual es el precio?",
                "¿Hay becas disponibles?",
                "Gracias por la informacion",
                "Si, me gustaria agendar una llamada",
                "¿Cuando empieza el siguiente curso?",
                "Perfecto, hablamos manana",
                "¿Me podrias mandar el temario?",
            ]),
            sent_by: i % 2 === 0 ? "Lead" : pick(["Virginia IA", "Patricia Asesor"]),
            status: "DELIVERED",
            created_at: daysAgo(rand(0, 30)),
        }));
    });
    await admin.from("chat_messages").insert(messages);
    console.log(`    -> ${conversaciones.length} conversaciones, ${messages.length} mensajes`);

    // ---------- 13. Citas (Appointments) ----------
    console.log("[13] Citas...");
    const appointments = leads.slice(0, 12).map((l, i) => ({
        tenant_id: tenantId,
        lead_id: l.id,
        advisor_id: advisorIds.length > 0 ? pick(advisorIds) : null,
        scheduled_at: i < 6 ? daysFromNow(rand(1, 14)) : daysAgo(rand(1, 30)),
        duration_minutes: pick([30, 45, 60]),
        status: i < 6 ? "SCHEDULED" : pick(["COMPLETED", "NO_SHOW", "CANCELLED"]),
        meeting_link: `https://meet.google.com/demo-${Math.random().toString(36).slice(2, 8)}`,
        notes: pick(["Primera llamada de info", "Revision de programa", "Cierre venta", "Followup post-demo"]),
    }));
    await admin.from("appointments").insert(appointments);
    console.log(`    -> ${appointments.length} citas`);

    // ---------- 14. Notificaciones ----------
    console.log("[14] Notificaciones...");
    const notifs = leads.slice(0, 15).map((l) => ({
        tenant_id: tenantId,
        id_lead: l.id,
        tipo: pick(["nuevo_lead", "llamada_perdida", "cita_proxima", "tarea_pendiente"]),
        titulo: pick(["Nuevo lead asignado", "Llamada perdida", "Cita en 1 hora", "Tarea pendiente"]),
        mensaje: "Notificacion demo generada por seed-demo.ts",
        leida: Math.random() > 0.5,
    }));
    await admin.from("notificaciones").insert(notifs);
    console.log(`    -> ${notifs.length} notificaciones`);

    // ---------- Resumen ----------
    console.log("\n========================================");
    console.log("Seed COMPLETADO");
    console.log("========================================");
    console.log(`  Tenant:   ${tenantId}`);
    console.log(`  Login:    ${DEMO_EMAIL}`);
    console.log(`  Password: en .env.local (DEMO_USER_PASSWORD)`);
    console.log(`  App URL:  http://localhost:8000`);
    console.log(`  Studio:   http://localhost:8300`);
    console.log("========================================");
}

main().catch((err) => {
    console.error("[seed-demo] error inesperado:", err);
    process.exit(1);
});
