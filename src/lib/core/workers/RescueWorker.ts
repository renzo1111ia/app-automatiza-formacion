import { getSupabaseServerClient } from "@/lib/supabase/server";
import { whatsappBridge } from "@/lib/integrations/whatsapp";
import { GlobalLogger } from "../logger";
import { AIRescueService } from "@/lib/services/ai-rescue";
import { AIAgent, AIAgentVariant, Lead, Database } from "@/types/database";

interface InactivityRules {
    inactivity_enabled?: boolean;
    inactivity_timeout?: number;
    inactivity_action?: 'MESSAGE' | 'NOTIFY';
    inactivity_message?: string;
    inactivity_ai_enabled?: boolean;
    max_retries?: number;
}

type LeadWithAgent = Lead & {
    ai_agents: AIAgent | null;
};

/**
 * DYNAMIC RESCUE WORKER v2.1
 * Resonates with each AI Agent's specific inactivity rules from their active variant.
 */
export async function runRescueCheck() {
    const supabase = await getSupabaseServerClient();
    const now = new Date();
    
    // 1. Fetch leads that are: 
    // - Assigned to an AI text agent
    // - Not paused
    const { data: leadsRaw, error } = await supabase
        .from("lead")
        .select("*, ai_agents(*)")
        .not("ai_agent_id", "is", null)
        .eq("is_ai_paused", false);

    if (error || !leadsRaw) return;

    const leads = leadsRaw as unknown as LeadWithAgent[];

    console.log(`[RESCUE v2.1] Checking ${leads.length} leads with active agents.`);

    for (const lead of leads) {
        try {
            const agent = lead.ai_agents;
            if (!agent) continue;

            // 2. Fetch the active variant for this agent to get the latest rules
            const { data: variantRaw } = await supabase
                .from("ai_agent_variants")
                .select("*")
                .eq("agent_id", agent.id)
                .eq("is_active", true)
                .eq("is_variant_b", false) // Assuming A is primary for now
                .single();

            if (!variantRaw) continue;
            const variant = variantRaw as unknown as AIAgentVariant;

            // 3. Extract rules from variant's automation_rules
            const rules = (variant.automation_rules as unknown as InactivityRules);
            
            if (!rules || !rules.inactivity_enabled) continue;

            const timeoutMins = rules.inactivity_timeout || 30;
            const maxRetries = rules.max_retries || 1;
            const action = rules.inactivity_action || "MESSAGE";
            const isAIEnabled = rules.inactivity_ai_enabled || false;
            
            // 4. Time check
            const lastTouch = new Date(lead.last_interaction_at || lead.fecha_actualizacion || new Date().toISOString());
            const diffMins = (now.getTime() - lastTouch.getTime()) / (1000 * 60);

            if (diffMins < timeoutMins) continue;

            // 5. Frequency & Safety check
            const sentCount = lead.inactivity_sent_count || 0;
            const metadata = (lead.metadata as Record<string, unknown> || {});
            const lastRescueAt = metadata.last_rescue_at ? new Date(metadata.last_rescue_at as string) : null;
            
            // Safety window: Never send two rescue messages within 5 minutes of each other
            if (lastRescueAt && (now.getTime() - lastRescueAt.getTime()) < (5 * 60 * 1000)) {
                console.log(`[RESCUE] ⏳ Safety window active for ${lead.telefono}. Skipping.`);
                continue;
            }

            if (sentCount >= maxRetries) continue;

            // 6. Fetch Tenant Credentials for WhatsApp
            const { data: tenantRaw } = await supabase
                .from("tenants")
                .select("config")
                .eq("id", lead.tenant_id)
                .single();
            
            const tenantConfig = (tenantRaw as unknown as { config: Record<string, unknown> })?.config;
            const waConfig = tenantConfig?.whatsapp as { accessToken: string; phoneNumberId: string } | undefined;

            if (!waConfig || !waConfig.accessToken || !waConfig.phoneNumberId) {
                await GlobalLogger.warn(lead.tenant_id, 'RESCUE', `Missing WhatsApp credentials for tenant`, { leadId: lead.id });
                continue;
            }

            console.log(`[RESCUE] Triggering ${isAIEnabled ? 'AI' : 'Static'} rescue for Lead ${lead.id} (Attempt ${sentCount + 1}/${maxRetries})`);
            
            // 7. Execute Action
            if (action === "MESSAGE") {
                let finalMessage = rules.inactivity_message || "¡Hola! ¿Sigues ahí?";

                if (isAIEnabled) {
                    // GENERATE SMART NUDGE
                    finalMessage = await AIRescueService.generateSmartNudge({
                        leadId: lead.id,
                        instructions: finalMessage,
                        agentPrompt: variant.prompt_text
                    });
                }

                await whatsappBridge.sendTextMessage(
                    lead.telefono || "",
                    finalMessage,
                    {
                        accessToken: waConfig.accessToken,
                        phoneNumberId: waConfig.phoneNumberId
                    }
                );

                // LOG THE RESCUE MESSAGE (So AI knows it was sent)
                const { ChatSummaryService } = await import("@/lib/services/knowledge-base");
                await ChatSummaryService.appendMessage(lead.tenant_id, lead.id, "Asistente", finalMessage);
                
                await (supabase.from("chat_messages") as any).insert({
                    tenant_id: lead.tenant_id,
                    lead_id: lead.id,
                    direction: "OUTBOUND",
                    message_type: "TEXT",
                    content: finalMessage,
                    sent_by: "SYSTEM_RESCUE",
                    status: "SENT",
                    metadata: { 
                        type: 'inactivity_rescue',
                        agent_id: agent.id
                    }
                });
            } else if (action === "NOTIFY") {
                // Future: Add notification logic here
                console.log(`[RESCUE] Notify action for lead ${lead.id} - Not implemented yet`);
            }

            // 8. Update tracking
            const updateData: Database["public"]["Tables"]["lead"]["Update"] = { 
                last_interaction_at: now.toISOString(),
                inactivity_sent_count: sentCount + 1,
                metadata: { 
                    ...(lead.metadata as Record<string, unknown> || {}), 
                    last_rescue_at: now.toISOString(),
                    last_rescue_agent: agent.id,
                    last_rescue_type: isAIEnabled ? 'AI' : 'STATIC'
                }
            };

            await supabase
                .from("lead")
                .update(updateData)
                .eq("id", lead.id);

            await GlobalLogger.info(lead.tenant_id, 'RESCUE', `Inactivity rescue sent (${isAIEnabled ? 'AI' : 'Static'})`, { leadId: lead.id, agentId: agent.id });

        } catch (err: unknown) {
            const error = err as Error;
            console.error(`[RESCUE] Failed to process lead ${lead.id}:`, error.message);
        }
    }
}
