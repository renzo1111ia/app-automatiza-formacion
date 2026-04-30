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
    advisor_id: string;
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

    const supabase = await getAdminSupabaseClient();
    const { data, error } = await (supabase
        .from("advisors" as any) as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");

    if (error) return { error: error.message };
    return { success: true, data: data as Advisor[] };
}

export async function saveAdvisor(advisor: Partial<Advisor> & { id?: string }) {
    const tenantId = await getActiveTenantId();
    if (!tenantId) return { error: "No hay un cliente seleccionado." };

    const supabase = await getAdminSupabaseClient();
    const payload = { ...advisor, tenant_id: tenantId };

    const { data, error } = advisor.id
        ? await (supabase.from("advisors" as any) as any).update(payload as any).eq("id", advisor.id).select().single()
        : await (supabase.from("advisors" as any) as any).insert(payload as any).select().single();

    if (error) return { error: error.message };
    return { success: true, data };
}

export async function deleteAdvisor(advisorId: string) {
    const supabase = await getAdminSupabaseClient();
    const { error } = await (supabase.from("advisors" as any) as any).delete().eq("id", advisorId);
    if (error) return { error: error.message };
    return { success: true };
}

// ─── Availability Slots ───────────────────────────────────────────

export async function getAdvisorSlots(advisorId: string) {
    const supabase = await getAdminSupabaseClient();
    const { data, error } = await (supabase
        .from("availability_slots" as any) as any)
        .select("*")
        .eq("advisor_id", advisorId)
        .order("day_of_week");

    if (error) return { error: error.message };
    return { success: true, data: data as AvailabilitySlot[] };
}

export async function saveAdvisorSlots(advisorId: string, slots: Partial<AvailabilitySlot>[]) {
    const supabase = await getAdminSupabaseClient();
    await (supabase.from("availability_slots" as any) as any).delete().eq("advisor_id", advisorId);

    if (slots.length === 0) return { success: true };

    const { error } = await (supabase
        .from("availability_slots" as any) as any)
        .insert(slots.map(s => ({ ...s, advisor_id: advisorId })) as any);

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

    const supabase = await getAdminSupabaseClient();
    let query = (supabase
        .from("appointments" as any) as any)
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
    const supabase = await getAdminSupabaseClient();
    const { error } = await (supabase
        .from("appointments" as any) as any)
        .update({ status, updated_at: new Date().toISOString() } as any)
        .eq("id", appointmentId);

    if (error) return { error: error.message };
    return { success: true };
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
    (data || []).forEach((row: any) => {
        const v = row.ab_variant as "A" | "B";
        if (v !== "A" && v !== "B") return;
        if (!stats[v]) return;
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
