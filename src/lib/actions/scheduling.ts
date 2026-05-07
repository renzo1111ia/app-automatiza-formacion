interface TenantConfig {
    scheduling?: {
        reminders?: {
            enabled: boolean;
            lead_time_minutes: number;
            repetitions: number;
            mode: 'manual' | 'ai';
            template: string;
        }
    }
}

export async function createAppointment(data: {
    lead_id: string;
    advisor_id?: string | null;
    scheduled_at: string;
    duration_minutes?: number;
    status?: string;
    agent_used?: string;
    ab_variant?: string;
}) {
    const tenantId = await getActiveTenantId();
    if (!tenantId) return { error: "No hay un cliente seleccionado." };

    const supabase = await getAdminSupabaseClient();
    
    // Fetch tenant config for reminders
    let leadTimeMinutes = 60; // Default
    const { data: tenant } = await supabase.from("tenants").select("config").eq("id", tenantId).single();
    const config = (tenant as { config: TenantConfig } | null)?.config;
    if (config?.scheduling?.reminders?.enabled) {
        leadTimeMinutes = config.scheduling.reminders.lead_time_minutes || 60;
    }

    // Calculate reminder time
    const scheduledDate = new Date(data.scheduled_at);
    const reminderDate = new Date(scheduledDate.getTime() - leadTimeMinutes * 60000);
    
    const { data: res, error } = await supabase
        .from("appointments")
        .insert({
            ...data,
            tenant_id: tenantId,
            duration_minutes: data.duration_minutes || 30,
            status: data.status || "PENDING",
            reminder_scheduled_at: reminderDate.toISOString()
        })
        .select()
        .single();

    if (error) return { error: error.message };
    return { success: true, data: res };
}

export async function cancelAppointment(appointmentId: string, reason?: string) {
    const supabase = await getAdminSupabaseClient();
    const { error } = await supabase
        .from("appointments")
        .update({ 
            status: "CANCELLED", 
            notes: reason ? `Cancelado por IA: ${reason}` : "Cancelado por IA",
            updated_at: new Date().toISOString() 
        })
        .eq("id", appointmentId);

    if (error) return { error: error.message };
    return { success: true };
}

export async function rescheduleAppointment(appointmentId: string, newDate: string) {
    const supabase = await getAdminSupabaseClient();
    
    const tenantId = await getActiveTenantId();
    let leadTimeMinutes = 60;
    if (tenantId) {
        const { data: tenant } = await supabase.from("tenants").select("config").eq("id", tenantId).single();
        const config = (tenant as { config: TenantConfig } | null)?.config;
        if (config?.scheduling?.reminders?.enabled) {
            leadTimeMinutes = config.scheduling.reminders.lead_time_minutes || 60;
        }
    }

    // Calculate new reminder time
    const scheduledDate = new Date(newDate);
    const reminderDate = new Date(scheduledDate.getTime() - leadTimeMinutes * 60000);

    const { error } = await supabase
        .from("appointments")
        .update({ 
            scheduled_at: newDate,
            reminder_scheduled_at: reminderDate.toISOString(),
            status: "PENDING", // Back to pending if rescheduled
            updated_at: new Date().toISOString() 
        })
        .eq("id", appointmentId);

    if (error) return { error: error.message };
    return { success: true };
}

export async function checkAvailability(advisorId: string, date: string) {
    const supabase = await getAdminSupabaseClient();
    
    // 1. Get advisor's configured day availability
    const d = new Date(date);
    const dayOfWeek = d.getDay(); // 0=Sunday, 1=Monday...
    
    const { data: slots, error: slotErr } = await supabase
        .from("availability_slots")
        .select("*")
        .eq("advisor_id", advisorId)
        .eq("day_of_week", dayOfWeek);

    if (slotErr) return { error: slotErr.message };
    
    if (!slots || slots.length === 0) {
        return { success: true, available: false, message: "Asesor no disponible este día de la semana." };
    }

    // 2. Get existing appointments for that day
    const dayStart = new Date(date);
    dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23,59,59,999);

    const { data: existing, error: aptErr } = await supabase
        .from("appointments")
        .select("scheduled_at, duration_minutes")
        .eq("advisor_id", advisorId)
        .neq("status", "CANCELLED")
        .gte("scheduled_at", dayStart.toISOString())
        .lte("scheduled_at", dayEnd.toISOString());

    if (aptErr) return { error: aptErr.message };

    return { 
        success: true, 
        config: slots[0], 
        busy_slots: (existing || []).map((e: { scheduled_at: string; duration_minutes: number | null }) => ({
            start: e.scheduled_at,
            end: new Date(new Date(e.scheduled_at).getTime() + (e.duration_minutes || 30) * 60000).toISOString()
        }))
    };
}

// ─── AB Metrics ───────────────────────────────────────────────────

export async function getABMetrics(agentId?: string) {
    const tenantId = await getActiveTenantId();
    if (!tenantId) return { error: "No hay un cliente seleccionado." };

    const supabase = await getAdminSupabaseClient();
    let query = supabase
        .from("orchestration_logs")
        .select("ab_variant, result, action_type, agent_used, executed_at")
        .eq("tenant_id", tenantId)
        .not("ab_variant", "is", null);

    if (agentId) query = query.eq("agent_used", agentId);

    const { data, error } = await query;
    if (error) return { error: error.message };

    const stats = { A: { total: 0, success: 0 }, B: { total: 0, success: 0 } };
    (data || []).forEach((row: { ab_variant: string | null; result: string }) => {
        const v = row.ab_variant as "A" | "B";
        if (v !== "A" && v !== "B") return;
        stats[v].total++;
        if (row.result === "SUCCESS") stats[v].success++;
    });

    return {
        success: true,
        data: {
            variantA: { total: stats.A.total, successRate: stats.A.total > 0 ? Math.round((stats.A.success / stats.A.total) * 100) : 0 },
            variantB: { total: stats.B.total, successRate: stats.B.total > 0 ? Math.round((stats.B.success / stats.B.total) * 100) : 0 },
            raw: data
        }
    };
}
