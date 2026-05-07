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
        if (!dateStr) return dateStr;
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

            // 1. Get Lead context
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: lead, error: leadError } = await (supabase.from("lead") as any)
                .select("*, lead_programas(id_programa, programas(nombre))")
                .eq("id", leadId)
                .single();
            
            if (leadError) {
                console.error(`[BOOK APPOINTMENT] Lead fetch error:`, leadError);
                throw new Error(`Error al obtener datos del prospecto: ${leadError.message}`);
            }

            const programId = lead?.lead_programas?.[0]?.id_programa;
            const programName = lead?.lead_programas?.[0]?.programas?.nombre;

            console.log(`[BOOK APPOINTMENT] 🔍 Searching advisors for tenant ${tenantId}...`);
            const { data: advisors, error: advError } = await (supabase.from("advisors") as any)
                .select("*")
                .eq("tenant_id", tenantId)
                .eq("is_active", true);

            if (advError) {
                console.error(`[BOOK APPOINTMENT] ❌ Advisor fetch error:`, advError);
                throw new Error(`Error al obtener asesores: ${advError.message}`);
            }

            console.log(`[BOOK APPOINTMENT] 📊 Found ${advisors?.length || 0} active advisors.`);

            // 2. Advisor Assignment
            const selectedAdvisor = advisors?.find((a: any) => 
                (a.specialties && (a.specialties.includes(programId) || a.specialties.includes(programName))) ||
                (a.courses && a.courses.includes(programName))
            ) || advisors?.[0];

            if (!selectedAdvisor) {
                console.warn(`[BOOK APPOINTMENT] ⚠️ No advisor found for tenant ${tenantId}. Proceeding with null advisor as requested.`);
            } else {
                console.log(`[BOOK APPOINTMENT] ✅ Selected Advisor: ${selectedAdvisor.name} (${selectedAdvisor.id})`);
            }

            // 3. Insert
            console.log(`[BOOK APPOINTMENT] ✍️ Inserting into DB. ScheduledAt: ${scheduledAt}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error: insertError } = await (supabase.from("appointments") as any).insert({
                tenant_id: tenantId,
                lead_id: leadId,
                advisor_id: selectedAdvisor?.id || null,
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
        console.log(`[CHECK AVAILABILITY] Checking for ${cleanDate} (original: ${date})`);
        const supabase = this.getSupabase();
        const dayOfWeek = new Date(cleanDate).getUTCDay(); // 0-6 (Sun-Sat)
        
        // Get slots for that day
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ranges } = await (supabase.from("availability_slots") as any)
            .select("*, advisors!inner(tenant_id)")
            .eq("day_of_week", dayOfWeek)
            .eq("advisors.tenant_id", tenantId);

        // Get existing appointments for that day
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from("appointments") as any)
            .select("scheduled_at, advisor_id")
            .eq("tenant_id", tenantId)
            .gte("scheduled_at", `${date}T00:00:00Z`)
            .lte("scheduled_at", `${date}T23:59:59Z`)
            .neq("status", "CANCELLED");

        const availableSlots: { time: string, advisor_id: string }[] = [];

        if (ranges) {
            for (const range of ranges) {
                const startTime = range.start_time;
                const endTime = range.end_time;
                const duration = range.slot_duration_minutes || 30;

                let current = this.parseTimeToMinutes(startTime);
                const end = this.parseTimeToMinutes(endTime);

                while (current < end) {
                    const timeString = this.minutesToTimeString(current);
                    
                    // Check if already booked
                    const isBooked = (existing as { scheduled_at: string; advisor_id: string }[])?.some((e) => 
                        e.scheduled_at.includes(timeString) && e.advisor_id === range.advisor_id
                    );

                    if (!isBooked) {
                        availableSlots.push({
                            time: timeString,
                            advisor_id: range.advisor_id
                        });
                    }
                    current += duration;
                }
            }
        }

        return {
            available_slots: availableSlots
        };
    }

    private static parseTimeToMinutes(timeStr: string): number {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    private static minutesToTimeString(totalMinutes: number): string {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }
}
