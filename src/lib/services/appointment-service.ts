import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { fromZonedTime } from "date-fns-tz";

export class AppointmentService {
    private static DEFAULT_TIMEZONE = "Europe/Madrid";

    private static getSupabase() {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        return createClient<Database>(url!, key!);
    }

    private static normalizeDate(dateStr: string): string {
        if (!dateStr) {
            return new Date().toISOString().split('T')[0];
        }
        const lower = dateStr.toLowerCase().trim();
        if (lower === 'mañana' || lower === 'manana') {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        }
        if (lower === 'hoy') {
            return new Date().toISOString().split('T')[0];
        }
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return dateStr.split('T')[0];
        }
        return dateStr;
    }

    static async bookAppointment(tenantId: string, leadId: string, date: string, time?: string, notes?: string) {
        const cleanDate = this.normalizeDate(date);
        console.log(`[BOOK APPOINTMENT] 🚀 Starting! Tenant: ${tenantId}, Lead: ${leadId}, Date: ${cleanDate}, Time: ${time}`);
        const supabase = this.getSupabase();

        let scheduledAt: string;

        if (time) {
            const timeStr = time.includes(':') ? (time.split(':').length === 2 ? `${time}:00` : time) : `${time}:00:00`;
            const fullLocalString = `${cleanDate} ${timeStr}`;
            try {
                const utcDate = fromZonedTime(fullLocalString, this.DEFAULT_TIMEZONE);
                scheduledAt = utcDate.toISOString();
            } catch (e) {
                console.warn(`[BOOK APPOINTMENT] Timezone conversion failed for ${fullLocalString}, falling back to UTC`, e);
                scheduledAt = `${cleanDate}T${timeStr}Z`;
            }
        } else {
            scheduledAt = `${cleanDate}T00:00:00Z`;
        }

        try {
            // 0. Auto-cancel existing appointments for this lead that day (best-effort)
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("appointments") as any)
                    .update({ status: "CANCELLED" })
                    .eq("lead_id", leadId)
                    .gte("scheduled_at", `${cleanDate}T00:00:00Z`)
                    .lte("scheduled_at", `${cleanDate}T23:59:59Z`);
            } catch (e) {
                console.warn("[BOOK APPOINTMENT] Auto-cancel skipped (non-fatal):", e);
            }

            // 1. Verify lead exists
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: leadError } = await (supabase.from("lead") as any)
                .select("id")
                .eq("id", leadId)
                .single();

            if (leadError) {
                throw new Error(`Error al obtener datos del prospecto: ${leadError.message}`);
            }

            // 2. Try to fetch program name (optional, never crash)
            let programName: string | null = null;
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: lp } = await (supabase.from("lead_programas") as any)
                    .select("programas(nombre)")
                    .eq("id_lead", leadId)
                    .limit(1)
                    .maybeSingle();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                programName = (lp as any)?.programas?.nombre || null;
            } catch (e) {
                console.warn("[BOOK APPOINTMENT] Could not fetch program name, skipping...", e);
            }

            const notesValue = notes
                ? `${notes}${programName ? ` (Programa: ${programName})` : ""}`
                : programName ? `Interesado en: ${programName}` : null;

            // 3. ADAPTIVE RETRY STRATEGY
            // We try the insert starting with a full payload.
            // On each "column not found" error we strip the offending field and retry.
            // The strip order goes from most optional to least optional.
            // The absolute bare-minimum (tenant_id, lead_id, scheduled_at) always works.
            const basePayload: Record<string, unknown> = {
                tenant_id: tenantId,
                lead_id: leadId,
                scheduled_at: scheduledAt,
            };

            // Full payload — we'll peel these off one by one if the DB rejects them
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentData: any = {
                ...basePayload,
                status: "PENDING",
                advisor_id: null,
                duration_minutes: 30,
                notes: notesValue,
                metadata: { source: "ai_wa_processor", extracted_program: programName },
            };

            // Strip order: most optional first
            const stripOrder = ["metadata", "notes", "duration_minutes", "advisor_id", "status"];

            console.log(`[BOOK APPOINTMENT] ✍️ Attempting insert with full payload. ScheduledAt: ${scheduledAt}`);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let appointment: any = null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let lastError: any = null;

            for (let i = 0; i <= stripOrder.length; i++) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await (supabase.from("appointments") as any)
                    .insert(i === 0 ? currentData : { ...currentData })
                    .select()
                    .single();

                if (!result.error) {
                    appointment = result.data;
                    lastError = null;
                    console.log(`[BOOK APPOINTMENT] ✅ Insert succeeded on attempt ${i + 1}`);
                    break;
                }

                lastError = result.error;
                const msg: string = lastError?.message || "";

                // Only retry for schema/column errors
                const isSchemaError =
                    msg.includes("column") ||
                    msg.includes("schema cache") ||
                    lastError?.code === "PGRST204";

                if (!isSchemaError) {
                    console.error(`[BOOK APPOINTMENT] ❌ Non-schema error, not retrying: ${msg}`);
                    break;
                }

                if (i < stripOrder.length) {
                    // Identify which column to strip from the error message, or use strip order
                    let fieldToRemove = stripOrder[i];
                    for (const f of stripOrder) {
                        if (msg.includes(f) && currentData[f] !== undefined) {
                            fieldToRemove = f;
                            break;
                        }
                    }
                    console.warn(`[BOOK APPOINTMENT] ⚠️ Schema issue: "${msg.substring(0, 100)}". Stripping '${fieldToRemove}' and retrying...`);
                    delete currentData[fieldToRemove];
                } else {
                    // All optional fields stripped, try absolute minimum
                    console.warn(`[BOOK APPOINTMENT] ⚠️ Final attempt with bare minimum payload...`);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const minResult = await (supabase.from("appointments") as any)
                        .insert(basePayload)
                        .select()
                        .single();
                    if (!minResult.error) {
                        appointment = minResult.data;
                        lastError = null;
                        console.log(`[BOOK APPOINTMENT] ✅ Bare-minimum insert succeeded.`);
                    } else {
                        lastError = minResult.error;
                    }
                    break;
                }
            }

            if (lastError) {
                console.error(`[BOOK APPOINTMENT] ❌ Permanent insert error after all retries:`, lastError);
                throw new Error(`Error persistente en base de datos al agendar: ${lastError.message}`);
            }

            console.log(`[BOOK APPOINTMENT] 🎉 Appointment created! ID: ${appointment?.id}`);
            return appointment;

        } catch (err: unknown) {
            console.error(`[BOOK APPOINTMENT] Critical failure:`, err);
            throw err;
        }
    }

    static async cancelAppointment(appointmentId: string) {
        const supabase = this.getSupabase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("appointments") as any)
            .update({ status: "CANCELLED" })
            .eq("id", appointmentId);
        if (error) throw error;
        return { success: true };
    }

    static async rescheduleAppointment(appointmentId: string, newDate: string, newTime?: string) {
        const supabase = this.getSupabase();
        let scheduledAt = newDate;
        if (newTime) {
            const timeStr = newTime.includes(':') ? (newTime.split(':').length === 2 ? `${newTime}:00` : newTime) : `${newTime}:00:00`;
            try {
                const utcDate = fromZonedTime(`${newDate} ${timeStr}`, this.DEFAULT_TIMEZONE);
                scheduledAt = utcDate.toISOString();
            } catch {
                scheduledAt = `${newDate}T${timeStr}Z`;
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("appointments") as any)
            .update({ scheduled_at: scheduledAt, status: "SCHEDULED" })
            .eq("id", appointmentId);
        if (error) throw error;
        return { success: true, newTime: scheduledAt };
    }

    static async checkAvailability(tenantId: string, date: string) {
        const cleanDate = this.normalizeDate(date);
        console.log(`[CHECK AVAILABILITY] 🔍 Checking for ${cleanDate} in ${this.DEFAULT_TIMEZONE}`);
        const supabase = this.getSupabase();

        // Determine day of week in Madrid timezone
        const referenceDate = fromZonedTime(`${cleanDate} 12:00:00`, this.DEFAULT_TIMEZONE);
        const dayOfWeek = referenceDate.getDay(); // 0-6 (Sun-Sat)

        // Get availability slots for that day
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ranges } = await (supabase.from("availability_slots") as any)
            .select("*")
            .eq("day_of_week", dayOfWeek)
            .eq("tenant_id", tenantId);

        // Define the time range for the day in UTC
        const startOfDayUTC = fromZonedTime(`${cleanDate} 00:00:00`, this.DEFAULT_TIMEZONE).toISOString();
        const endOfDayUTC = fromZonedTime(`${cleanDate} 23:59:59`, this.DEFAULT_TIMEZONE).toISOString();

        // Get existing appointments for that day
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from("appointments") as any)
            .select("scheduled_at, advisor_id")
            .eq("tenant_id", tenantId)
            .gte("scheduled_at", startOfDayUTC)
            .lte("scheduled_at", endOfDayUTC)
            .neq("status", "CANCELLED");

        const availableSlots: { time: string, advisor_id: string }[] = [];

        if (ranges) {
            for (const range of ranges) {
                const startTime = range.start_time;
                const endTime = range.end_time;
                const duration = range.slot_duration_minutes || 30;
                const advisorId = range.advisor_id;

                let currentMin = this.parseTimeToMinutes(startTime);
                const endMin = this.parseTimeToMinutes(endTime);

                while (currentMin < endMin) {
                    const timeStr = this.minutesToTimeString(currentMin);
                    const slotFullString = `${cleanDate} ${timeStr}`;
                    const slotUTC = fromZonedTime(slotFullString, this.DEFAULT_TIMEZONE).toISOString();

                    const isBooked = (existing as { scheduled_at: string; advisor_id: string }[])?.some((e) => {
                        const existingISO = new Date(e.scheduled_at).toISOString();
                        return existingISO === slotUTC && e.advisor_id === advisorId;
                    });

                    if (!isBooked) {
                        availableSlots.push({
                            time: timeStr.substring(0, 5),
                            advisor_id: advisorId
                        });
                    }
                    currentMin += duration;
                }
            }
        }

        console.log(`[CHECK AVAILABILITY] ✅ Found ${availableSlots.length} available slots.`);
        return {
            date: cleanDate,
            available_slots: availableSlots
        };
    }

    private static parseTimeToMinutes(timeStr: string): number {
        const actualTime = timeStr.includes('T') ? timeStr.split('T')[1].substring(0, 5) : timeStr;
        const [h, m] = actualTime.split(':').map(Number);
        return h * 60 + m;
    }

    private static minutesToTimeString(totalMinutes: number): string {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }
}
