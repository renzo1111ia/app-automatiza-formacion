"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────

export interface OrchestratorSequenceStep {
    step: number;
    action: "call" | "whatsapp" | "ai_agent" | "wait" | "zoho" | "crm";
    agents?: string[];       // Array de agent IDs para A/B
    template?: string;       // WhatsApp template name
    delay_hours: number;     // Horas de espera antes de este paso
    variableMappings?: Record<string, string>; // Mapeo de variables {{1}} -> lead.field
}

export interface OrchestratorTimezoneRules {
    start: string;              // "09:00"
    end: string;                // "20:00"
    working_days: number[];     // [1,2,3,4,5] = Lun-Vie
    phone_prefix_map: Record<string, string>; // "+34" → "Europe/Madrid"
}

export interface OrchestratorABConfig {
    enabled: boolean;
    split: number; // 0.0 – 1.0, default 0.5
}

export interface OrchestratorRetellConfig {
    api_key: string;
    from_number: string;
}

export interface OrchestratorEscalationConfig {
    notify_crm: boolean;
    notify_human_whatsapp: string | null;  // Teléfono del humano para recibir alertas
    trigger_max_attempts: number;          // Intentos fallidos de la IA antes de derivar
    handoff_on_qualified_not_booked: boolean; // Derivar si está cualificado pero no agendó
}

export interface OrchestratorSchedulingConfig {
    reminder_hours: number;
    reminder_template: string;
    slot_pacing_minutes: number;
    messages_per_slot: number;
}

export interface TenantOrchestratorConfig {
    timezone_rules: OrchestratorTimezoneRules;
    sequence: OrchestratorSequenceStep[];
    ab_testing: OrchestratorABConfig;
    retell: OrchestratorRetellConfig;
    escalation: OrchestratorEscalationConfig;
    scheduling: OrchestratorSchedulingConfig;
    flow_graph?: { nodes: unknown[]; edges: unknown[] };
    company_name?: string;
}

const DEFAULT_CONFIG: TenantOrchestratorConfig = {
    timezone_rules: {
        start: "09:00",
        end: "20:00",
        working_days: [1, 2, 3, 4, 5],
        phone_prefix_map: {
            "+34": "Europe/Madrid",
            "+56": "America/Santiago",
            "+52": "America/Mexico_City",
            "+57": "America/Bogota",
            "+51": "America/Lima",
            "+54": "America/Argentina/Buenos_Aires",
            "+598": "America/Montevideo",
        }
    },
    sequence: [
        { step: 1, action: "call",   agents: [], delay_hours: 0 },
        { step: 2, action: "whatsapp", template: "", delay_hours: 0 },
        { step: 3, action: "call",   agents: [], delay_hours: 27 },
    ],
    ab_testing: {
        enabled: false,
        split: 0.5,
    },
    retell: {
        api_key: "",
        from_number: ""
    },
    escalation: {
        notify_crm: true,
        notify_human_whatsapp: "",
        trigger_max_attempts: 3,
        handoff_on_qualified_not_booked: true
    },
    scheduling: {
        reminder_hours: 24,
        reminder_template: "appointment_reminder_es",
        slot_pacing_minutes: 30,
        messages_per_slot: 5
    },
    flow_graph: { nodes: [], edges: [] },
    company_name: "Automatiza Formación"
};

// ─── Server Actions ───────────────────────────────────────────────

/**
 * Fetches the orchestrator config for the active tenant.
 */
export async function getOrchestratorConfig(): Promise<{ success: boolean; data?: TenantOrchestratorConfig; error?: string }> {
    try {
        const tenantId = await getActiveTenantId();
        if (!tenantId) return { success: false, error: "No hay un cliente seleccionado." };

        const supabase = await getAdminSupabaseClient();
        const { data, error } = await (supabase.from("tenant_orchestrator_config" as any) as any)
            .select("config, flow_graph")
            .eq("tenant_id", tenantId)
            .single();

        if (error || !data) {
            return { success: true, data: DEFAULT_CONFIG };
        }

        const merged = deepMerge(DEFAULT_CONFIG, data.config as any);
        merged.flow_graph = (data.flow_graph as any) || DEFAULT_CONFIG.flow_graph;
        return { success: true, data: merged };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return { success: false, error: msg };
    }
}

/**
 * Saves the orchestrator config for the active tenant (upsert).
 */
export async function saveOrchestratorConfig(config: Partial<TenantOrchestratorConfig>): Promise<{ success: boolean; error?: string }> {
    try {
        const tenantId = await getActiveTenantId();
        if (!tenantId) return { success: false, error: "No hay un cliente seleccionado." };

        const supabase = await getAdminSupabaseClient();
        console.log(`[SAVE_FLOW] Saving for tenant ${tenantId}. Graph nodes: ${config.flow_graph?.nodes?.length || 0}`);

        const { error } = await (supabase.from("tenant_orchestrator_config" as any) as any)
            .upsert({ 
                tenant_id: tenantId, 
                flow_graph: config.flow_graph || { nodes: [], edges: [] }
            }, { 
                onConflict: "tenant_id",
                ignoreDuplicates: false 
            });

        if (error) {
            console.error("[SAVE_FLOW] Upsert Error:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("[SAVE_FLOW] Critical Catch:", msg);
        return { success: false, error: msg };
    }
}

/**
 * Server-side use for orchestrator execution engine.
 */
export async function getOrchestratorConfigForTenant(tenantId: string): Promise<TenantOrchestratorConfig> {
    try {
        const supabase = await getAdminSupabaseClient();
        const { data } = await (supabase.from("tenant_orchestrator_config" as any) as any)
            .select("config")
            .eq("tenant_id", tenantId)
            .single();

        if (!data) return DEFAULT_CONFIG;
        return deepMerge(DEFAULT_CONFIG, data.config as any);
    } catch {
        return DEFAULT_CONFIG;
    }
}

// ─── Utility ──────────────────────────────────────────────────────

function deepMerge<T extends Record<string, any>>(base: T, override: Partial<T>): T {
    const result = { ...base };
    for (const key in override) {
        const val = override[key];
        if (val && typeof val === "object" && !Array.isArray(val)) {
            result[key] = deepMerge(base[key] as Record<string, any>, val as Record<string, any>) as T[typeof key];
        } else if (val !== undefined) {
            result[key] = val as T[typeof key];
        }
    }
    return result;
}
