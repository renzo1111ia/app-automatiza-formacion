import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CRMFactory } from "@/lib/integrations/crm/factory";
import { Lead, AIAgentVariant } from "@/types/database";

/**
 * CRM EXPORT PROCESSOR
 * Synchronizes lead data from local DB to external CRM using custom mappings.
 */
export class CRMExportProcessor {
    /**
     * Executes the synchronization for a specific lead.
     */
    public async exportLead(leadId: string, tenantId: string) {
        const supabase = await getSupabaseServerClient();

        // 1. Fetch Lead data
        // We use a safe cast to bypass the 'never' inference issue while avoiding 'any'
        const { data: lead } = await (supabase.from("lead") as unknown as { select: (s: string) => { eq: (k: string, v: string) => { single: () => Promise<{ data: Lead | null }> } } })
            .select("*")
            .eq("id", leadId)
            .single();

        if (!lead) {
            console.error(`[CRM_EXPORT] Lead ${leadId} not found.`);
            return { success: false, error: "Lead not found" };
        }

        const l = lead;

        // 2. Fetch Agent Config (CRM Sync settings)
        const { data: agent } = await (supabase.from("ai_agents") as unknown as { select: (s: string) => { eq: (k: string, v: string) => { eq: (k2: string, v2: string) => { single: () => Promise<{ data: { id: string } | null }> } } } })
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("type", "QUALIFY")
            .single();

        if (!agent) {
            console.warn(`[CRM_EXPORT] No active qualify agent found for tenant ${tenantId}`);
            return { success: false, error: "No config found" };
        }

        const { data: variant } = await (supabase.from("ai_agent_variants") as unknown as { select: (s: string) => { eq: (k: string, v: string) => { eq: (k2: string, v2: boolean) => { single: () => Promise<{ data: AIAgentVariant | null }> } } } })
            .select("*")
            .eq("agent_id", agent.id)
            .eq("is_active", true)
            .single();

        if (!variant || !variant.crm_config) {
            console.warn(`[CRM_EXPORT] No CRM config in active variant for agent ${agent.id}`);
            return { success: false, error: "No CRM config" };
        }

        const v = variant;
        const crmConfig = v.crm_config as Record<string, unknown>;

        if (!crmConfig.provider || crmConfig.provider === 'NONE') {
            return { success: true, message: "CRM Sync disabled" };
        }

        // 3. Prepare Mapping
        const mappings = (crmConfig.field_mapping as Array<{tag: string, crm_key: string}>) || [];
        const updateData: Record<string, unknown> = {};

        // Fetch latest qualification summary if exists
        const { data: qual } = await (supabase.from("lead_cualificacion") as unknown as { select: (s: string) => { eq: (k: string, v: string) => { order: (k2: string, o: { ascending: boolean }) => { limit: (n: number) => { single: () => Promise<{ data: { cualificacion: string, calificacion_score: number } | null }> } } } } })
            .select("cualificacion, calificacion_score")
            .eq("id_lead", leadId)
            .order("fecha_creacion", { ascending: false })
            .limit(1)
            .single();

        const metadata = (l.metadata as Record<string, unknown>) || {};
        const summary = qual?.cualificacion || "Sin resumen disponible.";

        for (const mapping of mappings) {
            const { tag, crm_key } = mapping;
            if (!tag || !crm_key) continue;

            if (tag === 'MEMORIA_TAG') {
                updateData[crm_key] = this.buildMemoriaTag(metadata, summary, qual?.calificacion_score);
            } else {
                const value = metadata[tag] || metadata[tag.toLowerCase()] || metadata[tag.toUpperCase()];
                if (value !== undefined) {
                    updateData[crm_key] = value;
                }
            }
        }

        if (Object.keys(updateData).length === 0) {
            console.log(`[CRM_EXPORT] No data to update for lead ${leadId}`);
            return { success: true };
        }

        // 4. Send to CRM via Provider
        try {
            const tenantConfig = { crm: { ...crmConfig, enabled: true } };
            const provider = CRMFactory.getProvider(tenantId, tenantConfig as unknown);
            
            console.log(`[CRM_EXPORT] Syncing lead ${leadId} to ${crmConfig.provider}...`, updateData);
            
            await provider.updateLead(l.id_lead_externo || leadId, updateData);

            // 5. Log Success
            await (supabase.from("orchestration_logs") as unknown as { insert: (d: object) => Promise<void> }).insert({
                tenant_id: tenantId,
                lead_id: leadId,
                action_type: "CRM_SYNC",
                result: "SUCCESS",
                executed_at: new Date().toISOString()
            });

            return { success: true };
        } catch (error: unknown) {
            const err = error as Error;
            console.error(`[CRM_EXPORT] Error syncing to CRM:`, err.message);
            
            await (supabase.from("orchestration_logs") as unknown as { insert: (d: object) => Promise<void> }).insert({
                tenant_id: tenantId,
                lead_id: leadId,
                action_type: "CRM_SYNC",
                result: "FAILURE",
                error_message: err.message,
                executed_at: new Date().toISOString()
            });

            return { success: false, error: err.message };
        }
    }

    private buildMemoriaTag(metadata: Record<string, unknown>, summary: string, score?: number): string {
        const timestamp = new Date().toLocaleString('es-ES', { timeZone: 'UTC' });
        const lines = [
            `🤖 AGENT MAESTRO - REPORTE DE INTELIGENCIA`,
            `📅 Fecha de Sincronización: ${timestamp} UTC`,
            `===========================================`,
            `📊 CUALIFICACIÓN: ${score ? `${score}/10` : 'PENDIENTE'}`,
            `📝 RESUMEN EJECUTIVO:`,
            `${summary}`,
            `===========================================`,
            `🔍 DATOS CAPTURADOS (MEMORIA DINÁMICA):`
        ];

        // Filter and sort metadata to show relevant business variables first
        const entries = Object.entries(metadata)
            .filter(([key]) => !['last_fact_update', 'chat_summary'].includes(key))
            .sort(([a], [b]) => a.localeCompare(b));

        if (entries.length > 0) {
            entries.forEach(([key, value]) => {
                const cleanKey = key.replace(/_/g, ' ').toUpperCase();
                const cleanValue = typeof value === 'object' ? JSON.stringify(value) : value;
                lines.push(`• ${cleanKey}: ${cleanValue}`);
            });
        } else {
            lines.push(`(Sin variables adicionales capturadas)`);
        }

        lines.push(`===========================================`);
        lines.push(`✨ Generado automáticamente por Agent Maestro.`);

        return lines.join("\n");
    }
}

export const crmExportProcessor = new CRMExportProcessor();
