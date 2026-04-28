import { getSupabaseServerClient } from "@/lib/supabase/server";
import { toZonedTime } from "date-fns-tz";

/**
 * INTERNAL CALENDAR SYSTEM
 * Managed slots, bookings, and round-robin scheduling.
 */

export interface AvailabilitySlot {
    id: string;
    tenant_id: string;
    advisor_id: string;
    start_time: string;
    end_time: string;
    is_booked: boolean;
}

export interface CalendarSlot {
    id: string;
    advisor_id: string;
    start_time: Date;
    end_time: Date;
    is_available: boolean;
}

export class CalendarService {
    /**
     * Finds available slots for a tenant and transforms them to the lead's local timezone.
     */
    public async getAvailableSlots(tenantId: string, leadTimezone: string) {
        const supabase = await getSupabaseServerClient();
        
        // 1. Fetch available slots for the tenant
        const { data, error } = await supabase
            .from("availability_slots")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("is_booked", false)
            .gte("start_time", new Date().toISOString());

        if (error || !data) {
            console.error("[CALENDAR] Error fetching slots:", error);
            return [];
        }

        const slots = data as AvailabilitySlot[];

        // 2. Transform each slot to the lead's timezone
        const transformedSlots = slots.map(slot => {
            // slots are stored in UTC in DB
            const startUTC = new Date(slot.start_time);
            const endUTC = new Date(slot.end_time);

            // Convert to lead's timezone for display/selection
            const startLocal = toZonedTime(startUTC, leadTimezone);
            const endLocal = toZonedTime(endUTC, leadTimezone);

            return {
                ...slot,
                start_local: startLocal,
                end_local: endLocal,
                timezone: leadTimezone
            };
        });

        console.log(`[CALENDAR] Found ${transformedSlots.length} slots for tenant ${tenantId} in ${leadTimezone}`);
        return transformedSlots;
    }

    /**
     * Simplified Round-Robin logic to select the next available advisor.
     */
    public async getNextAvailableAdvisor(tenantId: string) {
        const supabase = await getSupabaseServerClient();
        
        // Fetch advisors ordered by last_booking_at
        const { data, error } = await supabase
            .from("advisors")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .order("last_booking_at", { ascending: true })
            .limit(1)
            .single();

        if (error || !data) return null;
        return data;
    }

    /**
     * Books an appointment and syncs back to CRM.
     */
    public async bookAppointment(tenantId: string, leadId: string, advisorId: string, startTime: Date) {
        const supabase = await getSupabaseServerClient();

        // 1. Insert Agendamiento
        await supabase
            .from("agendamientos")
            .insert({
                tenant_id: tenantId,
                id_lead: leadId,
                fecha_agendada_cliente: startTime.toISOString(),
                confirmado: true
            });

        // 2. TODO: Call Orchestrator to notify next step
        console.log(`[CALENDAR] Appointment booked for lead ${leadId} with advisor ${advisorId}`);
    }
}

export const calendarService = new CalendarService();
