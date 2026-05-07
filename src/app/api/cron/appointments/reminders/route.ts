import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_SERVICE_ROLE_KEY } from "@/lib/auth-config";
import { whatsappBridge } from "@/lib/integrations/whatsapp";
import { Database } from "@/types/database";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

interface ReminderAppointment {
    id: string;
    lead_id: string;
    advisor_id: string | null;
    scheduled_at: string;
    status: string;
    reminder_scheduled_at: string | null;
    reminder_sent_at: string | null;
    tenant_id: string;
    lead: { id: string; nombre: string | null; apellido: string | null; telefono: string } | null;
    tenant: { id: string; config: Record<string, any> } | null;
    advisors: { name: string } | null;
}

/**
 * APPOINTMENT REMINDER CRON v2
 * Supports custom templates, AI mode, and variables.
 */
export async function GET() {
    // We use the service role key to bypass RLS and reach all tenants
    const supabase = createClient<Database>(AUTH_SUPABASE_URL!, AUTH_SUPABASE_SERVICE_ROLE_KEY!);
    const now = new Date().toISOString();

    try {
        console.log("[REMINDER CRON] 🕒 Checking for pending reminders...");

        // 1. Fetch appointments due for reminder
        // We cast to unknown first to safely bypass strict DB types if 'appointments' is missing from schema
        const { data, error: fetchError } = await (supabase
            .from("appointments" as any)
            .select(`
                *,
                lead:leads(id, nombre, apellido, telefono),
                tenant:tenants(id, config),
                advisors:advisors(name)
            `)
            .in("status", ["PENDING", "CONFIRMED"])
            .lte("reminder_scheduled_at", now)
            .is("reminder_sent_at", null)
            .limit(20) as unknown as { data: ReminderAppointment[] | null; error: any });

        if (fetchError) throw fetchError;
        
        if (!data || data.length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: "No reminders due." });
        }

        const results = [];

        for (const apt of data) {
            try {
                const lead = apt.lead;
                const tenant = apt.tenant;
                const config = (tenant?.config?.scheduling as any)?.reminders;
                const waConfig = (tenant?.config as any)?.whatsapp;

                // Skip if reminders are disabled for this tenant
                if (config && config.enabled === false) {
                    // Mark as "sent" (skipped) so we don't process it again
                    await (supabase.from("appointments" as any) as any).update({ reminder_sent_at: now }).eq("id", apt.id);
                    continue;
                }

                if (!lead?.telefono) throw new Error("Lead has no phone.");
                if (!waConfig?.accessToken || !waConfig?.phoneNumberId) throw new Error("WhatsApp credentials missing.");

                // 2. Determine Message Content
                const scheduledTime = new Date(apt.scheduled_at);
                const spainTime = scheduledTime.toLocaleTimeString("es-ES", { 
                    hour: "2-digit", 
                    minute: "2-digit", 
                    timeZone: "Europe/Madrid" 
                });

                let message = "";

                if (config?.mode === "ai") {
                    // AI MODE: Generate message using OpenAI
                    console.log(`[REMINDER CRON] 🤖 Generating AI reminder for ${lead.nombre}`);
                    
                    // We try to find an API key in the tenant config or use env
                    const apiKey = (tenant?.config as any)?.openai?.api_key || process.env.OPENAI_API_KEY;
                    if (!apiKey) throw new Error("No OpenAI API Key found for AI reminder.");

                    const openai = new OpenAI({ apiKey });
                    const completion = await openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: "Eres un asistente de Esden Business School. Tu tarea es generar un recordatorio de cita corto, amable y profesional para WhatsApp. No uses negritas excesivas ni emojis exagerados. Máximo 250 caracteres." },
                            { role: "user", content: `Genera un recordatorio para:
                                Lead: ${lead.nombre}
                                Cita: hoy a las ${spainTime} (Hora España)
                                Asesor: ${apt.advisors?.name || "un asesor de admisiones"}
                                Objetivo: Confirmar asistencia y generar entusiasmo.` 
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 150
                    });

                    message = completion.choices[0].message.content || "";
                } else {
                    // MANUAL MODE: Use template and replace variables
                    const template = config?.template || "Hola {nombre}, te recordamos tu cita de hoy a las {hora} (España). ¡Te esperamos!";
                    message = template
                        .replace(/{nombre}/g, lead.nombre || "")
                        .replace(/{apellido}/g, lead.apellido || "")
                        .replace(/{hora}/g, spainTime)
                        .replace(/{asesor}/g, apt.advisors?.name || "un asesor")
                        .replace(/{fecha}/g, scheduledTime.toLocaleDateString("es-ES"));
                }

                // 3. Send Message
                console.log(`[REMINDER CRON] 📤 Sending reminder to ${lead.telefono}`);
                await whatsappBridge.sendTextMessage(lead.telefono, message, {
                    accessToken: waConfig.accessToken,
                    phoneNumberId: waConfig.phoneNumberId
                });

                // 4. Mark as sent
                await (supabase
                    .from("appointments" as any) as any)
                    .update({ reminder_sent_at: now })
                    .eq("id", apt.id);

                results.push({ id: apt.id, status: "SENT", lead: lead.nombre, mode: config?.mode || "manual" });

            } catch (err) {
                const errMsg = err instanceof Error ? err.message : "Unknown error";
                console.error(`[REMINDER CRON] ❌ Error in apt ${apt.id}:`, errMsg);
                results.push({ id: apt.id, status: "FAILED", error: errMsg });
            }
        }

        return NextResponse.json({ success: true, processed: data.length, results });

    } catch (error) {
        console.error("[REMINDER CRON] 💀 Critical error:", error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
