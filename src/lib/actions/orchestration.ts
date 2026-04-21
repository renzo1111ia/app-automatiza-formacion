"use server";

import { Lead } from "@/types/database";

import { getActiveTenantConfig } from "./tenant";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { whatsappBridge, WhatsAppConfig } from "../integrations/whatsapp";
import { orchestrator } from "@/lib/core/orchestrator";

/**
 * Fetches WhatsApp templates for the currently active tenant
 */
export async function getWhatsAppTemplates() {
    try {
        const tenant = await getActiveTenantConfig();
        if (!tenant) throw new Error("No active tenant selected.");

        interface TenantConfigStructure {
            whatsapp?: {
                templates?: unknown[];
                accessToken?: string;
                phoneNumberId?: string;
                wabaId?: string;
            };
        }

        const config = (tenant.config || {}) as TenantConfigStructure;

        // 1. Try to return cached templates first (for UI speed)
        if (config.whatsapp?.templates && Array.isArray(config.whatsapp.templates) && config.whatsapp.templates.length > 0) {
            console.log(`[ACTIONS] Returning ${config.whatsapp.templates.length} cached WhatsApp templates.`);
            return { success: true, data: config.whatsapp.templates };
        }

        if (!config.whatsapp?.accessToken || !config.whatsapp?.wabaId || !config.whatsapp?.phoneNumberId) {
            return { error: "Configuración de WhatsApp incompleta. Por favor, sincroniza las plantillas en Ajustes." };
        }

        const whatsapp = config.whatsapp; // Now inferred as non-nullable

        const waConfig: WhatsAppConfig = {
            accessToken: whatsapp.accessToken as string, // Cast just to be safe with the type system
            phoneNumberId: whatsapp.phoneNumberId as string,
            wabaId: whatsapp.wabaId as string
        };

        const templates = await whatsappBridge.getAvailableTemplates(waConfig);
        return { success: true, data: templates };
    } catch (error: unknown) {
        const err = error as Error;
        console.error("[ACTIONS] Error fetching WhatsApp templates:", err.message);
        return { error: err.message };
    }
}

/**
 * Returns recent leads for the active tenant (for the playground)
 */
export async function getRecentLeads(limit = 20) {
    try {
        const supabase = await getSupabaseServerClient();
        const tenant = await getActiveTenantConfig();
        if (!tenant) return { error: "No active tenant" };

        const { data, error } = await supabase.from("lead")
            .select("id, nombre, apellido, telefono, origen, fecha_creacion")
            .eq("tenant_id", tenant.id)
            .order("fecha_creacion", { ascending: false })
            .limit(limit);

        if (error) return { error: error.message };
        return { success: true, data };
    } catch (e: unknown) {
        return { error: (e as Error).message };
    }
}

/**
 * Returns all workflows for the active tenant
 */
export async function getTenantWorkflows() {
    try {
        const supabase = await getSupabaseServerClient();
        const tenant = await getActiveTenantConfig();
        if (!tenant) return { error: "No active tenant" };

        const { data, error } = await supabase.from("workflows")
            .select("id, name, is_primary, is_active")
            .eq("tenant_id", tenant.id)
            .order("created_at", { ascending: false });

        if (error) return { error: error.message };
        return { success: true, data };
    } catch (e: unknown) {
        return { error: (e as Error).message };
    }
}

/**
 * Gets the rules for a workflow (to preview the steps)
 */
export async function getWorkflowRules(workflowId: string) {
    try {
        const supabase = await getSupabaseServerClient();
        const { data, error } = await supabase.from("orchestration_rules")
            .select("*")
            .eq("workflow_id", workflowId)
            .eq("is_active", true)
            .order("sequence_order", { ascending: true });

        if (error) return { error: error.message };
        return { success: true, data };
    } catch (e: unknown) {
        return { error: (e as Error).message };
    }
}

/**
 * Triggers the orchestrator for a specific lead + workflow
 */
export async function triggerOrchestratorForLead(leadId: string, workflowId: string) {
    try {
        const supabase = await getSupabaseServerClient();
        const tenant = await getActiveTenantConfig();
        if (!tenant) return { error: "No active tenant" };

        // Fetch lead
        const { data: lead, error: leadError } = await supabase.from("lead")
            .select("*")
            .eq("id", leadId)
            .single();

        if (leadError || !lead) return { error: "Lead no encontrado: " + leadError?.message };

        const logs: string[] = [];
        const originalLog = console.log;

        // Capture logs
        console.log = (...args: unknown[]) => {
            const line = args.map(String).join(" ");
            if (line.includes("[ORCHESTRATOR]")) logs.push(line);
            originalLog(...args);
        };

        await orchestrator.executeWorkflow(workflowId, lead as unknown as Lead, tenant.id, {});

        console.log = originalLog;

        return { success: true, logs, leadId, workflowId };
    } catch (e: unknown) {
        return { error: (e as Error).message };
    }
}

/**
 * Fetches recent system logs for the active tenant
 */
export async function getSystemLogs(limit = 100) {
    try {
        const supabase = await getSupabaseServerClient();
        const tenant = await getActiveTenantConfig();
        if (!tenant) return { error: "No active tenant" };

        const { data, error } = await supabase.from("system_logs")
            .select("*")
            .eq("tenant_id", tenant.id)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) return { error: error.message };
        return { success: true, data };
    } catch (e: unknown) {
        return { error: (e as Error).message };
    }
}
