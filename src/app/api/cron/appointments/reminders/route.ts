import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_SERVICE_ROLE_KEY } from "@/lib/auth-config";
import { whatsappBridge } from "@/lib/integrations/whatsapp";
import { Database } from "@/types/database";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

/**
 * APPOINTMENT REMINDER CRON v2
 * Supports custom templates, AI mode, and variables.
 */
export async function GET() {
    const supabase = createClient<Database>(AUTH_SUPABASE_URL!, AUTH_SUPABASE_SERVICE_ROLE_KEY!);
    const now = new Date().toISOString();

    try {
        console.log("[REMINDER CRON] 🕒 Checking for pending reminders...");

        // 1. Fetch appointments due for reminder
        const { data: appts, error: fetchError } = await (supabase
            .from("appointments") as any)
            .select(`
                *,
                lead:leads(id, nombre, apellido, telefono),
                tenant:tenants(id, config),
                advisors:advisors(name)
            `)
            .in("status", ["PENDING", "CONFIRMED"])
            .lte("reminder_scheduled_at", now)
            .is("reminder_sent_at", null)
            .limit(20);

        if (fetchError) throw fetchError;
        
        if (!appts || (appts as any[]).length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: "No reminders due." });
        }

        const results = [];

        for (const apt of (appts as any[])) {
            try {
                const lead = apt.lead;
                const tenant = apt.tenant;
                const config = tenant?.config?.scheduling?.reminders;
                const waConfig = tenant?.config?.whatsapp;

                // Skip if reminders are disabled for this tenant
                if (config && config.enabled === false) {
                    console.log(`[REMINDER CRON] ⏭️ Reminders disabled for tenant ${apt.tenant_id}. Skipping.`);
                    // Mark as "sent" (skipped) so we don't process it again
                    await supabase.from("appointments").update({ reminder_sent_at: now } as any).eq("id", apt.id);
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
                    const apiKey = tenant?.config?.openai?.api_key || process.env.OPENAI_API_KEY;
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
                await supabase
                    .from("appointments")
                    .update({ reminder_sent_at: now } as any)
                    .eq("id", apt.id);

                results.push({ id: apt.id, status: "SENT", lead: lead.nombre, mode: config?.mode || "manual" });

            } catch (err) {
                const errMsg = err instanceof Error ? err.message : "Unknown error";
                console.error(`[REMINDER CRON] ❌ Error in apt ${apt.id}:`, errMsg);
                results.push({ id: apt.id, status: "FAILED", error: errMsg });
            }
        }

        return NextResponse.json({ success: true, processed: (appts as any[]).length, results });

    } catch (error) {
        console.error("[REMINDER CRON] 💀 Critical error:", error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
