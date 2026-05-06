import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

export class AppointmentService {
    private static getSupabase() {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        return createClient<Database>(url!, key!);
    }

    static async bookAppointment(tenantId: string, leadId: string, date: string, time?: string, notes?: string) {
        const supabase = this.getSupabase();
        let scheduledAt = date;
        if (time) {
            const timeStr = time.includes(':') ? (time.split(':').length === 2 ? `${time}:00` : time) : `${time}:00:00`;
            scheduledAt = `${date}T${timeStr}Z`;
        }

        // 1. Get Lead context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lead } = await (supabase.from("lead") as any).select("*, lead_programas(id_programa, programas(nombre))").eq("id", leadId).single();
        const programId = lead?.lead_programas?.[0]?.id_programa;
        const programName = lead?.lead_programas?.[0]?.programas?.nombre;

        // 2. Advisor Assignment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: advisors } = await (supabase.from("advisors") as any).select("*").eq("tenant_id", tenantId).eq("is_active", true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selectedAdvisor = advisors?.find((a: any) => a.specialties?.includes(programId) || a.specialties?.includes(programName)) || advisors?.[0];

        // 3. Insert
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from("appointments") as any).insert({
            tenant_id: tenantId,
            lead_id: leadId,
            advisor_id: selectedAdvisor?.id || null,
            scheduled_at: scheduledAt,
            status: "SCHEDULED",
            notes: notes || `Agendado por IA. Programa: ${programName}`
        }).select().single();

        if (error) throw error;
        return data;
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
        const supabase = this.getSupabase();
        const dayOfWeek = new Date(date).getUTCDay(); // 0-6 (Sun-Sat)
        
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
