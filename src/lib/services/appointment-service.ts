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
            // Default to today if no date provided
            return new Date().toISOString().split('T')[0];
        }
        const lower = dateStr.toLowerCase().trim();
        // Simple normalization for common Spanish relative dates
        if (lower === 'mañana' || lower === 'mañana') {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        }
        if (lower === 'hoy') {
            return new Date().toISOString().split('T')[0];
        }
        // Match YYYY-MM-DD
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
            // If time is provided, we assume it's in Spain's timezone (Europe/Madrid)
            // unless it already has an offset (which the AI usually doesn't send)
            const timeStr = time.includes(':') ? (time.split(':').length === 2 ? `${time}:00` : time) : `${time}:00:00`;
            const fullLocalString = `${cleanDate} ${timeStr}`;
            
            // Create a date object interpreting it as Madrid time, then get ISO UTC
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
            // 0. Auto-cancel previous appointments for this lead on the same day to avoid duplicates
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("appointments") as any)
                .update({ status: "CANCELLED", notes: "Cancelado automáticamente por nuevo agendamiento" })
                .eq("lead_id", leadId)
                .gte("scheduled_at", `${cleanDate}T00:00:00Z`)
                .lte("scheduled_at", `${cleanDate}T23:59:59Z`)
                .neq("status", "CANCELLED");

            // 1. Get Lead context (Simple fetch first to avoid relationship errors)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: lead, error: leadError } = await (supabase.from("lead") as any)
                .select("*")
                .eq("id", leadId)
                .single();
            
            if (leadError) {
                console.error(`[BOOK APPOINTMENT] Lead fetch error:`, leadError);
                throw new Error(`Error al obtener datos del prospecto: ${leadError.message}`);
            }

            // 1.1 Try to get program name separately (optional, don't crash if it fails)
            let programName = null;
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: lp } = await (supabase.from("lead_programas") as any)
                    .select("programas(nombre)")
                    .eq("id_lead", leadId)
                    .limit(1)
                    .maybeSingle();
                
                programName = (lp as any)?.programas?.nombre;
            } catch (e) {
                console.warn("[BOOK APPOINTMENT] Could not fetch program name, skipping...", e);
            }

            // 2. Advisor Assignment (Skipped during booking as requested)
            const selectedAdvisorId = null; 
            console.log(`[BOOK APPOINTMENT] ✅ Proceeding without advisor assignment (will be assigned later).`);

            // 3. Insert
            console.log(`[BOOK APPOINTMENT] ✍️ Inserting into DB. ScheduledAt: ${scheduledAt}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error: insertError } = await (supabase.from("appointments") as any).insert({
                tenant_id: tenantId,
                lead_id: leadId,
                advisor_id: selectedAdvisorId,
                scheduled_at: scheduledAt,
                duration_minutes: 30, // Ensure duration is provided
                status: "PENDING",
                notes: notes || `Agendado por IA. Programa: ${programName || 'No especificado'}`
            }).select().single();

            if (insertError) {
                console.error(`[BOOK APPOINTMENT] ❌ Insert error:`, insertError);
                throw new Error(`Error en base de datos al agendar: ${insertError.message}`);
            }

            console.log(`[BOOK APPOINTMENT] 🎉 Success! Appointment ID: ${data.id}`);
            return data;
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
            scheduledAt = `${newDate}T${timeStr}Z`;
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
        
        // 1. Determine day of week in Madrid
        // Using a fixed time (midday) to ensure we get the correct day of week in that timezone
        const referenceDate = fromZonedTime(`${cleanDate} 12:00:00`, this.DEFAULT_TIMEZONE);
        const dayOfWeek = referenceDate.getDay(); // 0-6 (Sun-Sat)
        
        // 2. Get availability slots for that day (either for an advisor or general tenant slots)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ranges } = await (supabase.from("availability_slots") as any)
            .select("*")
            .eq("day_of_week", dayOfWeek)
            .eq("tenant_id", tenantId);

        // 3. Define the time range for the whole day in UTC to fetch appointments
        const startOfDayUTC = fromZonedTime(`${cleanDate} 00:00:00`, this.DEFAULT_TIMEZONE).toISOString();
        const endOfDayUTC = fromZonedTime(`${cleanDate} 23:59:59`, this.DEFAULT_TIMEZONE).toISOString();

        // 4. Get existing appointments for that day (using Madrid day boundaries in UTC)
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
                    const timeStr = this.minutesToTimeString(currentMin); // "HH:MM:00"
                    
                    // Convert this specific slot to UTC ISO for comparison
                    const slotFullString = `${cleanDate} ${timeStr}`;
                    const slotUTC = fromZonedTime(slotFullString, this.DEFAULT_TIMEZONE).toISOString();
                    
                    // Check if already booked
                    // We compare the ISO strings exactly
                    const isBooked = (existing as { scheduled_at: string; advisor_id: string }[])?.some((e) => {
                        const existingISO = new Date(e.scheduled_at).toISOString();
                        return existingISO === slotUTC && e.advisor_id === advisorId;
                    });

                    if (!isBooked) {
                        availableSlots.push({
                            time: timeStr.substring(0, 5), // Return "HH:MM" for AI friendliness
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
        // If it's a full ISO string (contains 'T'), extract the time part
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
