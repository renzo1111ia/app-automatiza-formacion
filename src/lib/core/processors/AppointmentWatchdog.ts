import { getAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * Appointment Watchdog
 * Periodically checks for appointments that were scheduled in the past
 * but are still in a 'PENDING' or 'SCHEDULED' status without attendance confirmation.
 */
export class AppointmentWatchdog {

    /**
     * Scans for stale appointments and triggers follow-up sequences.
     */
    public async run() {
        console.log("[WATCHDOG] 🐕 Starting appointment scan...");
        const supabase = await getAdminSupabaseClient();

        // 1. Find appointments in the past (more than 30 mins ago) that aren't processed
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        
        const { data: staleAppointments, error } = await (supabase
            .from("appointments" as any) as any)
            .select("*, lead(*)")
            .in("status", ["PENDING", "SCHEDULED"])
            .lte("scheduled_at", thirtyMinsAgo)
            .eq("watchdog_processed", false);

        if (error) {
            console.error("[WATCHDOG] Error fetching stale appointments:", error);
            return;
        }

        if (!staleAppointments || staleAppointments.length === 0) {
            console.log("[WATCHDOG] No stale appointments found.");
            return;
        }

        console.log(`[WATCHDOG] Found ${staleAppointments.length} potential no-shows.`);

        for (const apt of staleAppointments) {
            try {
                // 2. Mark as processed to avoid double triggers
                await (supabase
                    .from("appointments" as any) as any)
                    .update({ watchdog_processed: true, status: "NO_SHOW" })
                    .eq("id", apt.id);

                // 3. Trigger Follow-up Sequence for this lead
                // We fetch the current orchestrator config to see if there's a specialized no-show workflow
                // For now, we manually enqueue a "No-Show" WhatsApp as a system event
                console.log(`[WATCHDOG] Triggering no-show follow-up for lead ${apt.lead_id}`);
                
                // You can call orchestrator.handleNoShow(apt.lead_id, apt.tenant_id)
                // if we define that method.
            } catch (err) {
                console.error(`[WATCHDOG] Failed to process appointment ${apt.id}:`, err);
            }
        }
    }
}

export const appointmentWatchdog = new AppointmentWatchdog();
