/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";
import { VoiceAgent, VoiceAgentVariant } from "@/types/database";
import { revalidatePath } from "next/cache";

/**
 * Los agentes de voz tienen su aislamiento garantizado por el tenant_id.
 * Este módulo gestiona CRUD de agentes y sus variantes A/B.
 * Usa el cliente servidor con SERVICE_ROLE_KEY — no requiere sesión de usuario.
 */

export async function getVoiceAgents(tenantId?: string) {
    try {
        const supabase = await getAdminSupabaseClient();
        
        let targetTenantId = tenantId;
        if (!targetTenantId) {
            targetTenantId = await getActiveTenantId() || undefined;
        }

        if (!targetTenantId) {
            return { success: false, error: "No target tenant specified" };
        }

        const { data, error } = await (supabase
            .from('voice_agents' as any) as any)
            .select('*')
            .eq('tenant_id', targetTenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, data: data as VoiceAgent[] };
    } catch (error: unknown) {
        console.error("Error getVoiceAgents:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getVoiceAgentVariants(agentId: string) {
    try {
        const supabase = await getAdminSupabaseClient();
        const { data, error } = await (supabase
            .from('voice_agent_variants' as any) as any)
            .select('*')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return { success: true, data: data as VoiceAgentVariant[] };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function saveVoiceAgent(agent: Partial<VoiceAgent>, tenantId: string) {
    try {
        const supabase = await getAdminSupabaseClient();

        if (agent.id) {
            const { data, error } = await (supabase
                .from('voice_agents' as any) as any)
                .update({ ...agent, updated_at: new Date().toISOString() })
                .eq('id', agent.id)
                .select()
                .single();
            if (error) throw error;
            return { success: true, data: data as VoiceAgent };
        } else {
            const { data, error } = await (supabase
                .from('voice_agents' as any) as any)
                .insert([{ ...agent, tenant_id: tenantId }])
                .select()
                .single();
            if (error) throw error;

            // Crear variantes iniciales por defecto A y B
            await (supabase.from('voice_agent_variants' as any) as any).insert([
                { agent_id: (data as any).id, is_variant_b: false, version_label: 'v1.0', prompt_text: 'Instrucciones iniciales...', weight: 0.5 },
                { agent_id: (data as any).id, is_variant_b: true, version_label: 'v1.0', prompt_text: 'Instrucciones iniciales...', weight: 0.5 }
            ]);

            return { success: true, data: data as VoiceAgent };
        }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function saveVoiceVariant(variant: Partial<VoiceAgentVariant>) {
    try {
        const supabase = await getAdminSupabaseClient();

        if (variant.id) {
            const { error } = await (supabase
                .from('voice_agent_variants' as any) as any)
                .update({ ...variant, updated_at: new Date().toISOString() })
                .eq('id', variant.id);
            if (error) throw error;
        } else {
            const { error } = await (supabase
                .from('voice_agent_variants' as any) as any)
                .insert([variant]);
            if (error) throw error;
        }
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

/**
 * Bulk-imports Retell agents into the local voice_agents table.
 */
export async function importRetellAgents(
    tenantId: string,
    retellAgents: {
        id: string;
        name: string;
        llm_id: string | null;
        voice_id: string | null;
        language: string;
    }[],
    retellApiKey: string
) {
    try {
        const { getRetellAgent } = await import("./retell-sync");
        const supabase = await getAdminSupabaseClient();

        console.log(`[importRetellAgents] Syncing ${retellAgents.length} agents...`);
        
        const records: any[] = [];
        const chunkSize = 5;
        for (let i = 0; i < retellAgents.length; i += chunkSize) {
            const chunk = retellAgents.slice(i, i + chunkSize);
            const details = await Promise.all(
                chunk.map(a => getRetellAgent(retellApiKey, a.id))
            );

            for (let j = 0; j < chunk.length; j++) {
                const a = chunk[j];
                const detail = details[j];
                
                const prompt = (detail.success && detail.data) ? detail.data.prompt : "";
                const llmConfigRaw = (detail.success && detail.data) ? detail.data.llm_config : null;
                
                let llmConfig = llmConfigRaw;
                if (llmConfigRaw && llmConfigRaw.states) {
                    llmConfig = { ...llmConfigRaw };
                    llmConfig.states = llmConfig.states.map((s: any) => ({
                        name: s.name,
                        state_prompt: s.state_prompt,
                        edges: s.edges
                    }));
                }
                
                records.push({
                    tenant_id: tenantId,
                    name: a.name || a.id,
                    provider: 'RETELL',
                    provider_agent_id: a.id,
                    retell_llm_id: a.llm_id || null,
                    voice_id: a.voice_id || null,
                    prompt_text_retell: prompt,
                    retell_llm_config: llmConfig,
                    status: 'ACTIVE',
                });
            }
        }

        const inserted: any[] = [];
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const { data: chunkInserted, error: upsertError } = await (supabase
                .from('voice_agents' as any) as any)
                .upsert(record, { 
                    onConflict: 'tenant_id,provider_agent_id',
                    ignoreDuplicates: false 
                })
                .select('id, provider_agent_id');

            if (upsertError) throw upsertError;
            if (chunkInserted) inserted.push(...chunkInserted);
        }

        const variantRows = (inserted || []).flatMap((row: any) => {
            const agentInfo = records.find(r => r.provider_agent_id === row.provider_agent_id);
            const prompt = agentInfo?.prompt_text_retell || "";
            return [
                { agent_id: row.id, is_variant_b: false, version_label: 'v1.0', prompt_text: prompt, weight: 0.5 },
                { agent_id: row.id, is_variant_b: true, version_label: 'v1.0', prompt_text: prompt, weight: 0.5 },
            ];
        });

        if (variantRows.length > 0) {
            await (supabase.from('voice_agent_variants' as any) as any)
                .upsert(variantRows, { onConflict: 'agent_id,version_label,is_variant_b' });
        }

        revalidatePath("/dashboard/voice-agents");
        return { success: true, imported: retellAgents.length };
    } catch (error: unknown) {
        console.error("Error importRetellAgents:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
