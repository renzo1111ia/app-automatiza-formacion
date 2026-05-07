"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";

export interface Advisor {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    is_active: boolean;
    specialties?: string[];
    handled_lead_types?: string[];
    origins?: string[];
    campaigns?: string[];
    countries?: string[];
    courses?: string[];
}

export interface AvailabilitySlot {
    id: string;
    advisor_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
}

export interface Appointment {
    id: string;
    advisor_id: string | null;
    lead_id: string | null;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
    notes: string | null;
    agent_used: string | null;
    ab_variant: string | null;
    advisors?: { name: string } | null;
    lead?: { nombre: string | null; apellido: string | null; telefono: string | null } | null;
}

// ─── Advisors ─────────────────────────────────────────────────────

export async function getAdvisors() {
    const tenantId = await getActiveTenantId();
    if (!tenantId) return { error: "No hay un cliente seleccionado." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminSupabaseClient()) as any;
    const { data, error } = await supabase
        .from("advisors")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");

    if (error) return { error: error.message };
    return { success: true, data: data as Advisor[] };
}

export async function saveAdvisor(advisor: Partial<Advisor> & { id?: string }) {
    const tenantId = await getActiveTenantId();
    if (!tenantId) return { error: "No hay un cliente seleccionado." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminSupabaseClient()) as any;
    
    // Clean payload: remove 'id' for inserts and ensure tenant_id is set
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: advisorId, ...cleanData } = advisor;
    
    const payload = { 
        ...cleanData, 
        tenant_id: tenantId 
    };

    console.log(`[SCHEDULING] Saving advisor: ${advisor.id ? 'UPDATE' : 'INSERT'}`, { id: advisor.id, name: advisor.name });

    const { data, error } = advisor.id
        ? await supabase.from("advisors").update(payload).eq("id", advisor.id).select().single()
        : await supabase.from("advisors").insert(payload).select().single();

    if (error) {
        console.error("[SCHEDULING] Error saving advisor:", error);
        return { error: error.message };
    }
    
    return { success: true, data };
}

export async function deleteAdvisor(advisorId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminSupabaseClient()) as any;
    const { error } = await supabase.from("advisors").delete().eq("id", advisorId);
    if (error) return { error: error.message };
    return { success: true };
}

// ─── Availability Slots ───────────────────────────────────────────

export async function getAdvisorSlots(advisorId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminSupabaseClient()) as any;
    const { data, error } = await supabase
        .from("availability_slots")
        .select("*")
        .eq("advisor_id", advisorId)
        .order("day_of_week");

    if (error) return { error: error.message };
    return { success: true, data: data as AvailabilitySlot[] };
}

export async function saveAdvisorSlots(advisorId: string, slots: Partial<AvailabilitySlot>[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminSupabaseClient()) as any;
    await supabase.from("availability_slots").delete().eq("advisor_id", advisorId);

    if (slots.length === 0) return { success: true };

    const { error } = await supabase
        .from("availability_slots")
        .insert(slots.map(s => ({ ...s, advisor_id: advisorId })));

    if (error) return { error: error.message };
    return { success: true };
}

// ─── Appointments ─────────────────────────────────────────────────

export async function getAppointments(options?: {
    from?: string;
    to?: string;
    advisorId?: string;
    status?: string;
}) {
    const tenantId = await getActiveTenantId();
    if (!tenantId) return { error: "No hay un cliente seleccionado." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminSupabaseClient()) as any;
    let query = supabase
        .from("appointments")
        .select("*, advisors(name), lead(nombre, apellido, telefono)")
        .eq("tenant_id", tenantId)
        .order("scheduled_at", { ascending: true });

    if (options?.from) query = query.gte("scheduled_at", options.from);
    if (options?.to) query = query.lte("scheduled_at", options.to);
    if (options?.advisorId) query = query.eq("advisor_id", options.advisorId);
    if (options?.status) query = query.eq("status", options.status);

    const { data, error } = await query;
    if (error) return { error: error.message };
    return { success: true, data: data as Appointment[] };
}

export async function updateAppointmentStatus(appointmentId: string, status: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminSupabaseClient()) as any;
    const { error } = await supabase
        .from("appointments")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", appointmentId);

    if (error) return { error: error.message };
    return { success: true };
}

// ─── Appointment Tools (for AI Agents) ───────────────────────────

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
    
    const { data: res, error } = await (supabase
        .from("appointments" as any) as any)
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
    const { error } = await (supabase
        .from("appointments" as any) as any)
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

    const { error } = await (supabase
        .from("appointments" as any) as any)
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
    
    const { data: slots, error: slotErr } = await (supabase
        .from("availability_slots" as any) as any)
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

    const { data: existing, error: aptErr } = await (supabase
        .from("appointments" as any) as any)
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
    let query = (supabase
        .from("orchestration_logs" as any) as any)
        .select("ab_variant, result, action_type, agent_used, executed_at")
        .eq("tenant_id", tenantId)
        .not("ab_variant", "is", null);

    if (agentId) query = query.eq("agent_used", agentId);

    const { data, error } = await query;
    if (error) return { error: error.message };

    const stats = { A: { total: 0, success: 0 }, B: { total: 0, success: 0 } };
    (data || []).forEach((row: { ab_variant: string; result: string }) => {
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
