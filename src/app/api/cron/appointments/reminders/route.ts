import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_SERVICE_ROLE_KEY } from "@/lib/auth-config";
import { whatsappBridge } from "@/lib/integrations/whatsapp";
import { Database } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * APPOINTMENT REMINDER CRON
 * Should be called every 5-10 minutes.
 * Finds appointments where reminder_scheduled_at <= now and reminder_sent_at is null.
 */
export async function GET() {
    // We use the service role key to bypass RLS and reach all tenants
    const supabase = createClient<Database>(AUTH_SUPABASE_URL!, AUTH_SUPABASE_SERVICE_ROLE_KEY!);
    const now = new Date().toISOString();

    try {
        console.log("[REMINDER CRON] 🕒 Checking for pending reminders...");

        // 1. Fetch appointments due for reminder
        // We filter for PENDING status since that's the default for AI-booked appointments
        const { data: appts, error: fetchError } = await (supabase
            .from("appointments") as any)
            .select(`
                *,
                lead:leads(id, nombre, apellido, telefono),
                tenant:tenants(id, config)
            `)
            .in("status", ["PENDING", "CONFIRMED"])
            .lte("reminder_scheduled_at", now)
            .is("reminder_sent_at", null)
            .limit(20);

        if (fetchError) throw fetchError;
        
        if (!appts || (appts as any[]).length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: "No reminders due." });
        }

        console.log(`[REMINDER CRON] 📦 Found ${(appts as any[]).length} reminders to process.`);
        const results = [];

        for (const apt of (appts as any[])) {
            try {
                const lead = apt.lead;
                const tenant = apt.tenant;
                const waConfig = tenant?.config?.whatsapp;

                if (!lead?.telefono) {
                    throw new Error(`Lead ${apt.lead_id} has no phone number.`);
                }

                if (!waConfig?.accessToken || !waConfig?.phoneNumberId) {
                    throw new Error(`WhatsApp credentials missing for tenant ${apt.tenant_id}`);
                }

                // 2. Prepare Reminder Message
                // We use Spain Time as the reference for the message
                const scheduledTime = new Date(apt.scheduled_at);
                const spainTime = scheduledTime.toLocaleTimeString("es-ES", { 
                    hour: "2-digit", 
                    minute: "2-digit", 
                    timeZone: "Europe/Madrid" 
                });

                const message = `Hola ${lead.nombre}, 👋 te recordamos que tienes una cita programada con un asesor de Esden hoy a las ${spainTime} (hora España). ¡Te esperamos!`;

                console.log(`[REMINDER CRON] 📤 Sending reminder to ${lead.telefono} for appointment ${apt.id}`);

                // 3. Send via WhatsApp Bridge
                await whatsappBridge.sendTextMessage(lead.telefono, message, {
                    accessToken: waConfig.accessToken,
                    phoneNumberId: waConfig.phoneNumberId
                });

                // 4. Update Database
                await supabase
                    .from("appointments")
                    .update({ 
                        reminder_sent_at: new Date().toISOString() 
                    } as any)
                    .eq("id", apt.id);

                results.push({ id: apt.id, status: "SENT", lead: lead.nombre });

            } catch (err) {
                const errMsg = err instanceof Error ? err.message : "Unknown error";
                console.error(`[REMINDER CRON] ❌ Failed to process reminder for apt ${apt.id}:`, errMsg);
                results.push({ id: apt.id, status: "FAILED", error: errMsg });
            }
        }

        return NextResponse.json({ 
            success: true, 
            processed: (appts as any[]).length, 
            results 
        });

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Internal Server Error";
        console.error("[REMINDER CRON] 💀 Critical error:", errMsg);
        return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }
}
