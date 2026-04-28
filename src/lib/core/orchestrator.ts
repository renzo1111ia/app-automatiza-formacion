/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isFeatureEnabled } from "./feature-flags";
import { buildComplianceDecision } from "./compliance";
import { whatsappBridge, WhatsAppConfig } from "../integrations/whatsapp";
import { retellBridge, RetellConfig } from "../integrations/retell";
import { ultravoxBridge } from "../integrations/ultravox";
import { getAgentVariants } from "../actions/agents";
import { getOrchestratorConfigForTenant, TenantOrchestratorConfig, OrchestratorSequenceStep } from "../actions/orchestrator-config";
import { enqueueLeadStep, LeadSequenceJob } from "./queue/lead-sequence-queue";
import { logOrchestrationStep } from "./scheduler";
import { Lead, PlannedAction, AIAgentVariant, Programa, VoiceAgent, VoiceAgentVariant } from "@/types/database";
import { CRMFactory } from "../integrations/crm/factory";
import { TelephonyFactory } from "../integrations/telephony/factory";
import { queryKnowledgeBase } from "../integrations/aws/bedrock";

/**
 * ORCHESTRATOR CORE v3.0
 * Enterprise-grade lead sequencer with:
 * - Timezone Compliance Guard
 * - BullMQ delayed execution
 * - A/B multi-agent testing with full logging
 * - Round Robin scheduling
 */
export class Orchestrator {
    private static instance: Orchestrator;

    public static getInstance(): Orchestrator {
        if (!Orchestrator.instance) {
            Orchestrator.instance = new Orchestrator();
        }
        return Orchestrator.instance;
    }

    // ─── MAIN ENTRY POINTS ─────────────────────────────────────────

    /**
     * Entry point for a new Lead.
     * Reads tenant config sequentially and applies compliance check first.
     */
    public async handleNewLead(leadId: string, tenantId: string) {
        const isNativeEnabled = await isFeatureEnabled(tenantId, "native_orchestrator");
        if (!isNativeEnabled) return;

        const supabase = await getSupabaseServerClient();
        const { data: lead, error } = await (supabase
            .from("lead" as any) as any).select("*").eq("id", leadId).single();
        if (error || !lead) return;

        // Load tenant's orchestrator config
        const config = await getOrchestratorConfigForTenant(tenantId);
        const sequence = config.sequence;

        if (!sequence || sequence.length === 0) {
            console.warn(`[ORCHESTRATOR] No sequence configured for tenant ${tenantId}`);
            return;
        }

        // Execute first step (subsequent steps will be queued by BullMQ)
        await this.executeSequenceStep(lead as Lead, tenantId, sequence, 0, config);
    }

    /**
     * Executes a specific step from a sequence.
     * Called directly (step 1) or by BullMQ Worker (deferred steps).
     */
    public async executeSequenceStep(
        lead: Lead,
        tenantId: string,
        sequence: OrchestratorSequenceStep[],
        stepIndex: number,
        config: TenantOrchestratorConfig
    ) {
        if (stepIndex >= sequence.length) {
            console.log(`[ORCHESTRATOR] Sequence complete for lead ${lead.id}`);
            return;
        }

        // ── SPEND LIMIT CHECK (Circuit Breaker) ───────────────────
        const supabase = await getSupabaseServerClient();
        const { data: tenant } = await supabase.from("tenants").select("daily_spend_limit, current_daily_spend").eq("id", tenantId).single();
        const t = tenant as any;
        if (t && t.current_daily_spend >= t.daily_spend_limit) {
            console.error(`[ORCHESTRATOR] 🔥 CIRCUIT BREAKER: Spend limit reached for tenant ${tenantId}`);
            await logOrchestrationStep({
                tenantId, leadId: lead.id, step: sequence[stepIndex].step,
                actionType: "SYSTEM", result: "SKIPPED",
                metadata: { reason: "Daily Spend Limit Reached (Circuit Breaker)" }
            });
            return;
        }

        const step = sequence[stepIndex];
        console.log(`[ORCHESTRATOR] Lead ${lead.id} → Step ${step.step}: ${step.action}`);

        // ── PERSISTENCE SYNC ──────────────────────────────────────
        // Refresh lead status from DB in case it was paused/disabled manually
        const { data: freshLead } = await (supabase.from("lead" as any) as any).select("*").eq("id", lead.id).single();
        
        if (freshLead && freshLead.is_ai_enabled === false) {
            console.log(`[ORCHESTRATOR] AI disabled for lead ${lead.id}. Stopping sequence.`);
            await logOrchestrationStep({
                tenantId, leadId: lead.id, step: step.step,
                actionType: "SYSTEM", result: "SKIPPED",
                metadata: { reason: "Human Intervention / AI Disabled" }
            });
            return;
        }

        const activeLead = (freshLead as Lead) || lead;

        // ── COMPLIANCE GUARD ──────────────────────────────────────
        const decision = buildComplianceDecision(
            activeLead.telefono || "",
            activeLead.pais || "",
            config.timezone_rules
        );

        // CHANNEL HOPPING: If outside hours and action is CALL, try WHATSAPP instead of queuing
        if (!decision.canExecuteNow && step.action === "call") {
             console.log(`[ORCHESTRATOR] Outside hours for call. Hopping to WhatsApp fallback for lead ${activeLead.id}`);
             // Check if we have a whatsapp fallback (usually it's the next step or a standard template)
             await this.executeWhatsAppStep(activeLead, tenantId, {
                 ...step,
                 action: "whatsapp",
                 template: "lead_followup_outside_hours" // Default fallback template
             } as any);
             return;
        }

        if (!decision.canExecuteNow && step.action !== "wait") {
            console.log(`[ORCHESTRATOR] ${decision.reason}`);
            // Queue for next window
            await this.queueStep(activeLead, tenantId, step, stepIndex, config, decision.delayMs);

            await logOrchestrationStep({
                tenantId,
                leadId: activeLead.id,
                step: step.step,
                actionType: step.action.toUpperCase(),
                result: "QUEUED",
                metadata: { scheduledFor: decision.scheduledFor?.toISOString(), reason: decision.reason }
            });
            return;
        }

        // ── EXECUTE STEP ──────────────────────────────────────────
        try {
            switch (step.action) {
                case "call":
                    try {
                        const callResult = await this.executeCallStep(activeLead, tenantId, step, config) as any;
                        
                        // ── ESCALATION CHECK: Qualified but no appointment ──────────
                        if (config.escalation?.handoff_on_qualified_not_booked) {
                            const { data: updatedLead } = await supabase.from("lead").select("current_stage, metadata").eq("id", activeLead.id).single();
                            const ul = updatedLead as any;
                            if (ul && ul.current_stage === "SCHEDULING") {
                                // If stage is scheduling but no appointment was recorded in this session (or call)
                                // We wait a bit or trigger if call result indicates no booking
                                if (callResult?.outcome !== "BOOKED") {
                                    await this.triggerHumanEscalation(activeLead, tenantId, config, "Qualified Lead - No Appointment Booked");
                                }
                            }
                        }
                    } catch {
                        console.error(`[ORCHESTRATOR] Call failed. Attempting WhatsApp fallback.`);
                        await this.executeWhatsAppStep(activeLead, tenantId, {
                            ...step,
                            action: "whatsapp",
                            template: "call_failed_fallback"
                        } as any);
                    }
                    break;
                case "whatsapp":
                    await this.executeWhatsAppStep(activeLead, tenantId, step);
                    break;
                case "ai_agent":
                    await this.executeAIAgentStep(activeLead, tenantId, step, config);
                    break;
                case "crm":
                case "zoho": // Backward compat
                    await this.executeCRMStep(activeLead, tenantId, step, config);
                    break;
                case "wait":
                    console.log(`[ORCHESTRATOR] Wait step, delay already applied.`);
                    break;
            }

            // ── QUEUE NEXT STEP ───────────────────────────────────
            const nextIndex = stepIndex + 1;
            if (nextIndex < sequence.length) {
                const nextStep = sequence[nextIndex];
                const delayMs = nextStep.delay_hours * 60 * 60 * 1000;
                await this.queueStep(activeLead, tenantId, nextStep, nextIndex, config, delayMs);
            }

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[ORCHESTRATOR] Step error:`, errMsg);
            await logOrchestrationStep({
                tenantId, leadId: activeLead.id, step: step.step,
                actionType: step.action.toUpperCase(), result: "FAILED", errorMessage: errMsg
            });
        }
    }

    /**
     * Legacy/Graph workflow-based execution (for Constructor builder or Webhooks).
     */
    public async executeWorkflow(workflowId: string, lead: Lead, tenantId: string, context: Record<string, unknown>, triggerNodeId?: string) {
        const supabase = await getSupabaseServerClient();
        let query = (supabase
            .from("orchestration_rules" as any) as any).select("*")
            .eq("workflow_id", workflowId).eq("is_active", true);

        if (triggerNodeId) {
            query = query.eq("trigger_node_id", triggerNodeId);
        }

        const { data: rules } = await query.order("sequence_order", { ascending: true });

        if (!rules || rules.length === 0) {
            console.warn(`[ORCHESTRATOR] No rules found for workflow ${workflowId}${triggerNodeId ? ` and trigger ${triggerNodeId}` : ""}`);
            return;
        }
        await this.executeRule(rules[0] as any, lead, tenantId, context);
    }

    // ─── STEP EXECUTORS ───────────────────────────────────────────

    private async executeCallStep(
        lead: Lead, tenantId: string,
        step: OrchestratorSequenceStep,
        config: TenantOrchestratorConfig
    ) {
        const supabase = await getSupabaseServerClient();
        const retellConfig = config.retell;
        let fromNumber = retellConfig?.from_number;
        const apiKey = retellConfig?.api_key;

        // 1. Initial Selection (Internal ID from step.agents or step.agentId)
        const { agentId: internalId, variant } = this.selectAgent(step.agents || [], config.ab_testing);
        
        // Final technical ID to send to Retell
        let technicalAgentId = internalId;
        let selectedPrompt = "";
        let vAgent: any = null;

        // 2. RESOLVE VOICE AGENT (Internal UUID -> Technical Provider ID)
        if (internalId && internalId.includes('-')) {
            const { data } = await supabase
                .from('voice_agents')
                .select('*')
                .eq('id', internalId)
                .single();
            
            vAgent = data;

            if (vAgent) {
                const voiceAgent = vAgent as VoiceAgent;
                technicalAgentId = voiceAgent.provider_agent_id || internalId;
                
                // PRIORITIZE AGENT-SPECIFIC NUMBER
                if (voiceAgent.from_number) {
                    fromNumber = voiceAgent.from_number;
                }

                // Load Variants for A/B Prompting
                const { data: variants } = await supabase
                    .from('voice_agent_variants')
                    .select('*')
                    .eq('agent_id', voiceAgent.id)
                    .order('created_at', { ascending: true });

                if (variants && variants.length > 0) {
                    const variantData = variants.find(v => (v as VoiceAgentVariant).is_variant_b === (variant === 'B')) || variants[0];
                    selectedPrompt = (variantData as VoiceAgentVariant).prompt_text;
                }
            }
        }

        // 3. CONSTRUCT CONTEXT
        const courseContext = await this.getCourseContext(lead.id);
        
        const dynamicVariables: Record<string, string> = {
            lead_name: lead.nombre || "Cliente",
            lead_phone: lead.telefono || "",
            company_name: config.company_name || "Esden",
            system_prompt_override: selectedPrompt, // If configured in Retell dashboard to use this var
            ...courseContext
        };

        // 4. INITIATE CALL
        if (lead.origen === 'Web Simulator' && !apiKey) {
            console.log(`[ORCHESTRATOR] [MOCK] Simulating call for lead ${lead.id}`);
            await new Promise(r => setTimeout(r, 1000));
        } else {
            // DETECT PROVIDER
            const provider = (internalId && (vAgent as any)?.provider) || 'RETELL';

            if (provider === 'ULTRAVOX') {
                const uApiKey = (config as any).ultravox?.api_key;
                if (!uApiKey) {
                    console.error(`[ORCHESTRATOR] Ultravox API Key missing for tenant ${tenantId}`);
                    return;
                }

                // 1. GET JOIN URL FROM ULTRAVOX
                const ultravoxRes = await ultravoxBridge.createAgentCall(
                    technicalAgentId as string,
                    {
                        templateContext: dynamicVariables,
                        medium: { twilio: {} }, // Current default for stream
                        recordingEnabled: true
                    },
                    { apiKey: uApiKey }
                );

                if (!ultravoxRes.join_url) {
                    throw new Error("Failed to get join_url from Ultravox");
                }

                // 2. TRIGGER TELEPHONY
                const telephonyProvider = TelephonyFactory.getProvider(config as any);
                const fromNum = fromNumber || (config as any).telephony?.credentials?.fromNumber;
                
                if (!fromNum) throw new Error("Missing fromNumber for telephony");

                const telRes = await telephonyProvider.triggerCall({
                    to: lead.telefono || "",
                    from: fromNum,
                    joinUrl: ultravoxRes.join_url,
                    recordingEnabled: true
                });

                if (!telRes.success) {
                    throw new Error(`Telephony Error: ${telRes.errorMessage}`);
                }

                console.log(`[ORCHESTRATOR] Ultravox call triggered via ${(config as any).telephony?.provider}. ID: ${telRes.providerCallId}`);

            } else {
                // DEFAULT: RETELL
                if (!apiKey || !technicalAgentId || !fromNumber) {
                    console.error(`[ORCHESTRATOR] Retell config or Technical Agent ID missing for tenant ${tenantId}`);
                    return;
                }

                await retellBridge.createCall(
                    lead.telefono || "",
                    technicalAgentId,
                    fromNumber,
                    { lead_id: lead.id, tenant_id: tenantId, agent_uuid: internalId || undefined, ab_variant: variant },
                    dynamicVariables,
                    { apiKey: apiKey as string }
                );
            }
        }

        await logOrchestrationStep({
            tenantId, leadId: lead.id, step: step.step,
            actionType: "CALL", agentUsed: (internalId || technicalAgentId) as string | undefined,
            abVariant: variant, result: "SUCCESS"
        });
    }

    private async executeWhatsAppStep(lead: Lead, tenantId: string, step: OrchestratorSequenceStep) {
        const supabase = await getSupabaseServerClient();
        const { data: tenant } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
        if (!tenant) return;

        const conf = (tenant as any).config;
        const waConfig: WhatsAppConfig = {
            accessToken: conf?.whatsapp?.accessToken,
            phoneNumberId: conf?.whatsapp?.phoneNumberId
        };
        
        const template = step.template || "";
        const mappings = step.variableMappings || {};

        // 1. Resolve parameters for BODY (standard Meta format)
        // Meta templates use {{1}}, {{2}}... we resolve them in order
        const parameters: any[] = [];
        const sortedIndices = Object.keys(mappings).sort((a, b) => parseInt(a) - parseInt(b));

        for (const idx of sortedIndices) {
            let value = mappings[idx];
            
            // Resolve dynamic variables
            if (value === "lead.nombre") value = lead.nombre || "Cliente";
            else if (value === "lead.apellido") value = lead.apellido || "";
            else if (value === "lead.email") value = lead.email || "";
            // ... add more as needed

            parameters.push({ type: "text", text: value });
        }

        const components = parameters.length > 0 ? [
            {
                type: "body",
                parameters: parameters
            }
        ] : [];

        if (lead.origen === 'Web Simulator' && !waConfig.accessToken) {
            console.log(`[ORCHESTRATOR] [MOCK] Simulating WhatsApp message for lead ${lead.id} with template ${template}`);
            await new Promise(r => setTimeout(r, 800));
        } else {
            if (!waConfig.accessToken || !waConfig.phoneNumberId) {
                console.warn(`[ORCHESTRATOR] WhatsApp credentials missing for tenant ${tenantId}`);
                return;
            }
            await whatsappBridge.sendTemplateMessage(lead.telefono || "", template, "es", components, waConfig);
        }

        await logOrchestrationStep({
            tenantId, leadId: lead.id, step: step.step,
            actionType: "WHATSAPP", result: "SUCCESS",
            metadata: { template, components }
        });
    }

    private async executeCRMStep(
        lead: Lead, 
        tenantId: string, 
        step: OrchestratorSequenceStep,
        config: TenantOrchestratorConfig
    ) {
        // Step metadata includes the specific mapping and action
        const { type, ownerId, tagName, transitionId, mappings } = (step as any).metadata || {};
        
        const provider = CRMFactory.getProvider(tenantId, config);

        try {
            switch (type) {
                case "UPDATE_LEAD":
                case "UPDATE_OWNER": {
                    // 1. Build Payload using Mappings
                    const payload: Record<string, any> = {};
                    
                    if (mappings) {
                        if (mappings.nombre && lead.nombre) payload[mappings.nombre] = lead.nombre;
                        if (mappings.apellido && lead.apellido) payload[mappings.apellido] = lead.apellido;
                        if (mappings.email && lead.email) payload[mappings.email] = lead.email;
                        if (mappings.telefono && lead.telefono) payload[mappings.telefono] = lead.telefono;
                        if (mappings.pais && lead.pais) payload[mappings.pais] = lead.pais;
                        if (mappings.origen && lead.origen) payload[mappings.origen] = lead.origen;
                    }

                    // 2. Add owner if specified
                    if (ownerId) payload["Owner"] = { id: ownerId };

                    await provider.updateLead(lead.id_lead_externo || "", payload);
                    break;
                }
                case "ADD_TAG":
                    await provider.addTags(lead.id_lead_externo || "", [tagName]);
                    break;
                case "BLUEPRINT":
                case "EXTERNAL_ACTION":
                    await provider.executeAction(lead.id_lead_externo || "", type === "BLUEPRINT" ? "BLUEPRINT" : transitionId, { transitionId });
                    break;
                case "CREATE_EVENT": {
                    const { subject, startTime, durationMinutes, description } = (step as any).metadata || {};
                    await provider.createEvent(lead.id_lead_externo || "", {
                        subject: subject || "Cita Agendada - Esden",
                        startTime: startTime || new Date().toISOString(),
                        durationMinutes: durationMinutes || 30,
                        description: description || `Cita con ${lead.nombre} ${lead.apellido}`
                    });
                    break;
                }
                default:
                    console.warn(`[ORCHESTRATOR] Unknown CRM action type: ${type}`);
            }

            await logOrchestrationStep({
                tenantId, leadId: lead.id, step: step.step,
                actionType: "CRM", result: "SUCCESS",
                metadata: { type, tagName, ownerId }
            });
        } catch (err) {
            console.error(`[ORCHESTRATOR] CRM execution error:`, err);
            throw err;
        }
    }

    private async executeAIAgentStep(
        lead: Lead, tenantId: string,
        step: OrchestratorSequenceStep,
        config: TenantOrchestratorConfig
    ) {
        const agentIds = step.agents || [];
        const { agentId, variant } = this.selectAgent(agentIds, config.ab_testing);
        
        if (!agentId) {
            console.warn(`[ORCHESTRATOR] AI Agent step has no agents configured`);
            return;
        }

        // 1. Fetch variants
        const { data: variants } = await getAgentVariants(agentId);
        
        // Update lead with currently active agent and reset inactivity counter
        const supabase = await getSupabaseServerClient();
        if (lead.ai_agent_id !== agentId) {
            await (supabase.from("lead" as any) as any)
                .update({ 
                    ai_agent_id: agentId,
                    inactivity_sent_count: 0
                })
                .eq("id", lead.id);
            
            console.log(`[ORCHESTRATOR] Lead ${lead.id} assigned to agent ${agentId}. Inactivity counter reset.`);
        }

        if (!variants || variants.length === 0) return;

        const promptVariantData = variants[0] as AIAgentVariant;
        
        // 2. Fetch Course Context from AWS RAG (v2.0 Logic)
        const courseContext = await this.getCourseContext(lead.id);
        const kbId = promptVariantData.knowledge_base_id || (config as any).aws?.kbId;
        
        let ragContext = "";
        if (kbId) {
            const results = await queryKnowledgeBase(`Info sobre ${courseContext.course_name}`, kbId);
            ragContext = results.map(r => r.text).join("\n\n");
        }

        // 3. Prompt Construction with Memory & Stages
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const systemPrompt = `
        ${promptVariantData.prompt_text}
        
        CONTEXTO DEL CURSO (PDF Knowledge Base):
        ${ragContext || courseContext.course_info}
        
        REGLAS DE CUALIFICACIÓN:
        ${courseContext.qualification_rules}
        
        DATOS EXTRAÍDOS DEL LEAD HASTA AHORA:
        ${JSON.stringify(lead.metadata || {})}
        
        ETAPA ACTUAL: ${lead.current_stage || 'QUALIFICATION'}
        `;

        // 4. In a real message event, this would be used for the AI Turn.
        // The orchestrator just ensures the agent is assigned and ready.
        
        await logOrchestrationStep({
            tenantId, leadId: lead.id, step: step.step,
            actionType: "AI_AGENT", agentUsed: agentId,
            abVariant: variant, result: "SUCCESS",
            metadata: { 
                stage: lead.current_stage,
                promptVersion: promptVariantData.version_label,
                ragUsed: !!ragContext
            }
        });
    }

    /**
     * Helper to fetch course-specific information and qualification rules.
     * Maps to course_info and qualification_rules variables in the prompt.
     */
    private async getCourseContext(leadId: string): Promise<Record<string, string>> {
        const supabase = await getSupabaseServerClient();
        
        // 1. Get the programs this lead is interested in
        const { data: leadPrograms } = await (supabase
            .from("lead_programas" as any) as any)
            .select("id_programa")
            .eq("id_lead", leadId);

        if (!leadPrograms || leadPrograms.length === 0) {
            return {
                course_info: "No hay información de curso específica disponible.",
                qualification_rules: "Criterios generales de cualificación."
            };
        }

        // 2. Get details for the first/primary program
        const { data: program } = await (supabase
            .from("programas" as any) as any)
            .select("*")
            .eq("id", leadPrograms[0].id_programa)
            .single();

        if (!program) {
            return {
                course_info: "Programa no encontrado.",
                qualification_rules: ""
            };
        }

        const p = program as Programa;
        const details = [
            p.presentacion && `Presentación: ${p.presentacion}`,
            p.objetivos && `Objetivos: ${p.objetivos}`,
            p.precio && `Precio: ${p.precio}`,
            p.becas_financiacion && `Becas: ${p.becas_financiacion}`,
            p.metodologia && `Metodología: ${p.metodologia}`,
            p.beneficios && `Beneficios: ${p.beneficios}`,
            p.practicas && `Prácticas: ${p.practicas}`,
            p.fechas_inicio && `Fechas de inicio: ${p.fechas_inicio}`,
        ].filter(Boolean).join("\n");

        return {
            course_name: p.nombre,
            course_info: details || "Sin detalles específicos.",
            qualification_rules: p.requisitos_cualificacion || "Cualificación estándar basada en interés y disponibilidad."
        };
    }

    // ─── A/B AGENT SELECTOR ────────────────────────────────────────

    /**
     * Selects an agent from an array based on A/B split configuration.
     * Returns the selected agent ID and which variant was chosen.
     */
    private selectAgent(
        agents: string[],
        abConfig: TenantOrchestratorConfig["ab_testing"]
    ): { agentId: string | null; variant: "A" | "B" | undefined } {
        if (!agents || agents.length === 0) return { agentId: null, variant: undefined };
        if (agents.length === 1) return { agentId: agents[0], variant: "A" };

        if (abConfig.enabled && agents.length >= 2) {
            const roll = Math.random();
            const isVariantA = roll <= abConfig.split;
            return {
                agentId: isVariantA ? agents[0] : agents[1],
                variant: isVariantA ? "A" : "B",
            };
        }

        return { agentId: agents[0], variant: "A" };
    }

    // ─── QUEUE HELPERS ────────────────────────────────────────────

    private async queueStep(
        lead: Lead,
        tenantId: string,
        step: OrchestratorSequenceStep,
        stepIndex: number,
        config: TenantOrchestratorConfig,
        delayMs: number
    ) {
        const job: LeadSequenceJob = {
            leadId: lead.id,
            tenantId,
            workflowId: "sequence",
            step: stepIndex,
            action: step.action as any,
            template: step.template,
        };

        await enqueueLeadStep(job, delayMs);
        console.log(`[ORCHESTRATOR] Queued step ${step.step} for lead ${lead.id} in ${Math.round(delayMs / 1000 / 60)}min`);
    }

    // ─── LEGACY SUPPORT (Constructor Builder) ─────────────────────

    private async executeRule(rule: any, lead: Lead, tenantId: string, context: Record<string, unknown>) {
        const { action_type, config: conf, workflow_id } = rule;

        const supabase = await getSupabaseServerClient();
        const { data: tenant } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
        const tenantConf = (tenant as any)?.config;

        switch (action_type) {
            case "CALL": {
                const retellConfig: RetellConfig = { apiKey: tenantConf?.retell?.apiKey };
                await retellBridge.createCall(
                    lead.telefono || "", 
                    conf?.agentId, 
                    tenantConf?.retell?.fromNumber,
                    { lead_id: lead.id }, 
                    {}, // empty dynamic variables for legacy
                    retellConfig
                );
                break;
            }
            case "WHATSAPP": {
                const waConfig: WhatsAppConfig = {
                    accessToken: tenantConf?.whatsapp?.accessToken,
                    phoneNumberId: tenantConf?.whatsapp?.phoneNumberId
                };
                
                const template = conf?.templateId || "";
                const mappings = conf?.variableMappings || {};
                
                const parameters: any[] = [];
                const sortedIndices = Object.keys(mappings).sort((a, b) => parseInt(a) - parseInt(b));

                for (const idx of sortedIndices) {
                    let value = mappings[idx];
                    if (value === "lead.nombre") value = lead.nombre || "Cliente";
                    else if (value === "lead.apellido") value = lead.apellido || "";
                    else if (value === "lead.email") value = lead.email || "";
                    parameters.push({ type: "text", text: value });
                }

                const components = parameters.length > 0 ? [
                    { type: "body", parameters: parameters }
                ] : [];

                await whatsappBridge.sendTemplateMessage(lead.telefono || "", template, "es", components, waConfig);
                break;
            }
            case "AI_AGENT": {
                const { data: variants } = await getAgentVariants(conf?.agentId);
                if (variants && variants.length > 0) {
                    const v = variants[0] as AIAgentVariant;
                    console.log(`[ORCHESTRATOR] AI Agent ${conf?.agentId}: ${v.version_label}`);
                }
                break;
            }
            case "CRM":
            case "ZOHO": {
                const { type, ownerId, tagName, transitionId, mappings } = conf || {};
                const provider = CRMFactory.getProvider(tenantId, tenantConf);
                const extId = lead.id_lead_externo || "";

                if (type === "UPDATE_OWNER" || type === "UPDATE_LEAD") {
                    const payload: Record<string, any> = {};
                    if (mappings) {
                        for (const [key, crmKey] of Object.entries(mappings)) {
                            if ((lead as any)[key]) payload[crmKey as string] = (lead as any)[key];
                        }
                    }
                    if (ownerId) payload["Owner"] = { id: ownerId };
                    await provider.updateLead(extId, payload);
                } 
                else if (type === "ADD_TAG") await provider.addTags(extId, [tagName]);
                else if (type === "BLUEPRINT" || type === "EXTERNAL_ACTION") {
                    await provider.executeAction(extId, type === "BLUEPRINT" ? "BLUEPRINT" : transitionId, { transitionId });
                }
                
                break;
            }
            default:
                console.warn(`[ORCHESTRATOR] Unknown rule action: ${action_type}`);
        }

        // Continue chain
        const { data: nextRule } = await (supabase
            .from("orchestration_rules" as any) as any).select("*")
            .eq("workflow_id", workflow_id).eq("is_active", true)
            .eq("sequence_order", (rule.sequence_order || 1) + 1).single();

        if (nextRule) await this.executeRule(nextRule, lead, tenantId, context);
    }

    // Kept for backward compat with sweep API
    public async executePlannedAction(action: PlannedAction) {
        const lead = (action as any).lead as Lead;
        if (!lead) return;

        const config = await getOrchestratorConfigForTenant(action.tenant_id);
        const step: OrchestratorSequenceStep = {
            step: 1,
            action: action.action_type.toLowerCase() as any,
            agents: [(action.config as any)?.agentId].filter(Boolean),
            template: (action.config as any)?.templateId,
            delay_hours: 0,
        };

        await this.executeSequenceStep(lead, action.tenant_id, [step], 0, config);
    }

    /**
     * Triggers human escalation based on config.
     */
    private async triggerHumanEscalation(lead: Lead, tenantId: string, config: TenantOrchestratorConfig, reason: string) {
        console.log(`[ORCHESTRATOR] 🚨 Triggering Escalation for Lead ${lead.id}. Reason: ${reason}`);
        
        const esc = config.escalation;
        const supabase = await getSupabaseServerClient();

        // 1. Mark lead as "Handed Off"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("lead").update({ 
            is_handed_off: true,
            handoff_reason: reason,
            assigned_advisor_id: null // Release for manual pickup
        }).eq("id", lead.id);

        // 2. Notify CRM (Task creation)
        if (esc?.notify_crm) {
            try {
                const provider = CRMFactory.getProvider(tenantId, config);
                await provider.executeAction(lead.id_lead_externo || "", "CREATE_TASK", {
                    subject: `Derivación Humana: ${reason}`,
                    description: `El lead necesita atención humana inmediata. Razón: ${reason}. Ver en Dashboard: https://automatiza.es/dashboard/leads/${lead.id}`,
                    priority: "High"
                });
            } catch (e) {
                console.error("[ORCHESTRATOR] CRM Handoff Failed:", e);
            }
        }

        // 3. Notify via WhatsApp to Sales Human
        if (esc?.notify_human_whatsapp) {
            try {
                // Get a WhatsApp provider (Twilio or Meta)
                const telephony = TelephonyFactory.getProvider(config as any);
                await (telephony as any).sendMessage?.(esc.notify_human_whatsapp, `ALERTA DERIVACIÓN HUMANA: Lead ${lead.nombre} ${lead.apellido} necesita atención. Razón: ${reason}`);
            } catch (e) {
                console.error("[ORCHESTRATOR] WA Handoff Failed:", e);
            }
        }

        await logOrchestrationStep({
            tenantId, leadId: lead.id, step: 0,
            actionType: "SYSTEM", result: "SUCCESS",
            metadata: { escalation: true, reason }
        });
    }
}

export const orchestrator = Orchestrator.getInstance();
