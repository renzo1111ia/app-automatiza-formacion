import { getSupabaseServerClient } from "@/lib/supabase/server";
import { analyzeConversation } from "./ai-analysis";
import { FactExtractionService } from "./fact-extractor";
import { CRMFactory } from "../integrations/crm/factory";
import { getOrchestratorConfigForTenant } from "@/lib/actions/orchestrator-config";
import { SchedulerService } from "./scheduler";

interface Lead {
    id: string;
    id_lead_externo: string | null;
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    pais: string | null;
}

/**
 * POST-ANALYSIS SERVICE
 * Coordinates AI extraction and CRM synchronization after a call or chat ends.
 * Ported logic from production n8n workflows.
 */
export class PostAnalysisService {
    /**
     * Main entry point for post-interaction analysis
     */
    static async processInteraction(params: {
        leadId: string;
        tenantId: string;
        transcript: string;
        channel: 'CALL' | 'WHATSAPP';
        externalId?: string; // Retell Call ID or WhatsApp Message ID
        durationMs?: number;
        disconnectionReason?: string | null;
    }) {
        const { leadId, tenantId, transcript, channel, externalId, durationMs, disconnectionReason } = params;
        const supabase = await getSupabaseServerClient();

        console.log(`[POST-ANALYSIS] Starting analysis for lead ${leadId} (${channel})`);

        try {
            // 1. Detect if call was "No Productive" (only for calls)
            let isUnproductive = false;
            if (channel === 'CALL') {
                const INVALID_REASONS = ['invalid_destination', 'telephony_provider_unavailable', 'telephony_provider_permission_denied'];
                if (durationMs && durationMs < 15000) isUnproductive = true;
                if (disconnectionReason && INVALID_REASONS.includes(disconnectionReason)) isUnproductive = true;
            }

            // 2. Extract Data with AI (if productive)
            const analysis = !isUnproductive && transcript.length > 50 
                ? await analyzeConversation(transcript, tenantId) 
                : {
                    qualified: "no" as const,
                    scheduled_call_confirmed: false,
                    reasons: disconnectionReason || (isUnproductive ? "Llamada no productiva" : "Conversación insuficiente"),
                    student_interest_level: 0,
                    lead_score: 0,
                    extracted_data: {
                        motivo_anulacion: disconnectionReason === 'invalid_destination' ? 'teléfono falso' : 'Ilocalizable'
                    }
                };

            console.log(`[POST-ANALYSIS] Analysis Result:`, analysis);

            // 3. Fetch Lead Data
            const { data: leadRaw } = await supabase.from("lead").select("*").eq("id", leadId).single();
            if (!leadRaw) throw new Error("Lead not found");
            const lead = leadRaw as unknown as Lead;

            // 4. Update qualification in DB
            const qualPayload = {
                tenant_id: tenantId,
                id_lead: leadId,
                cualificacion: analysis.qualified,
                motivo_anulacion: analysis.extracted_data.MOTIVO_DESCARTE || analysis.extracted_data.motivo_anulacion,
                anios_experiencia: analysis.extracted_data["YEARS_EXPERIENCE"] || analysis.extracted_data["YEARS_ EXPERIENCIE"] || analysis.extracted_data["YEARS_EXPERIENCIE"] || analysis.extracted_data.años_experiencia,
                nivel_estudios: analysis.extracted_data.USER_ESTUDIES || analysis.extracted_data.nivel_estudios,
            };

            const { data: existingQual } = await supabase.from("lead_cualificacion").select("id").eq("id_lead", leadId).single();
            if (existingQual) {
                await supabase.from("lead_cualificacion").update(qualPayload).eq("id", existingQual.id);
            } else {
                await supabase.from("lead_cualificacion").insert(qualPayload);
            }

            // 4b. PASS 2 — Fact extraction for ALL tracked variables
            // This extracts REGLA_APLICADA, QA_HANDLED, QA_TOPIC, ESTADO, MOTIVO_DESCARTE etc.
            let factData: Record<string, string> = {};
            if (transcript.length > 50 && !isUnproductive) {
                try {
                    const { data: agentVariant } = await supabase
                        .from("ai_agent_variants" as unknown as string)
                        .select("api_key, tracked_variables")
                        .eq("tenant_id", tenantId)
                        .eq("is_active", true)
                        .not("api_key", "is", null)
                        .order("updated_at", { ascending: false })
                        .limit(1)
                        .maybeSingle() as unknown as { data: { api_key: string; tracked_variables: string[] } | null };

                    const apiKey = (agentVariant as { api_key?: string } | null)?.api_key;
                    const trackedVars = (agentVariant as { tracked_variables?: string[] } | null)?.tracked_variables || [];

                    if (apiKey && trackedVars.length > 0) {
                        console.log(`[POST-ANALYSIS] Running fact extraction for ${trackedVars.length} tracked vars`);
                        const facts = await FactExtractionService.extractFromDialogue(
                            leadId,
                            transcript,
                            trackedVars,
                            apiKey,
                            tenantId
                        );
                        if (facts) factData = facts;
                        console.log(`[POST-ANALYSIS] Fact extraction captured: ${Object.keys(factData).join(', ')}`);
                    }
                } catch (factErr) {
                    console.warn(`[POST-ANALYSIS] Fact extraction failed (non-blocking):`, factErr);
                }
            }

            // 4c. PERSIST METADATA IN LEAD TABLE (merge basic + fact extraction)
            const currentMetadata = (leadRaw as Record<string, unknown>).metadata || {};
            const updatedMetadata = {
                ...(currentMetadata as Record<string, unknown>),
                ...analysis.extracted_data,
                ...factData,
                QUALIFIED: analysis.qualified === "si" ? "SI" : "NO",
                last_fact_update: new Date().toISOString()
            };

            const mainUpdate: Record<string, unknown> = { metadata: updatedMetadata };
            if (analysis.extracted_data.USER_NAME) {
                 const parts = String(analysis.extracted_data.USER_NAME).trim().split(' ');
                 mainUpdate.nombre = parts[0];
                 if (parts.length > 1) mainUpdate.apellido = parts.slice(1).join(' ');
            }
            if (analysis.extracted_data.USER_COUNTRY) {
                mainUpdate.pais = analysis.extracted_data.USER_COUNTRY;
            }

            await (supabase.from("lead") as unknown as { update: (d: unknown) => { eq: (col: string, val: string) => Promise<unknown> } }).update(mainUpdate).eq("id", leadId);

            // 5. Handle Scheduling / Retries
            if (analysis.qualified === "si" && (analysis.scheduled_call_confirmed || analysis.extracted_data.date_time_preferred)) {
                // Lead is qualified and scheduled a call
                const fechaCita = analysis.extracted_data.date_time_preferred || new Date().toISOString();
                await (supabase.from("agendamientos" as unknown as string) as unknown as { insert: (d: unknown) => Promise<unknown> }).insert({
                    tenant_id: tenantId,
                    id_lead: leadId,
                    fecha_agendada_lead: fechaCita,
                    confirmado: true
                });
            } else if (analysis.qualified !== "si") {
                 // Manage Retry Counters
                 const { data: lastAttempts } = await (supabase
                    .from("intentos_llamadas")
                    .select("numero_intento")
                    .eq("id_lead", leadId)
                    .order("numero_intento", { ascending: false })
                    .limit(1) as unknown as Promise<{ data: Array<{ numero_intento: number }> | null }>);
                 
                 const lastAttemptNum = (lastAttempts as Array<{ numero_intento: number }> | null)?.[0]?.numero_intento ?? 0;

                 if (lastAttemptNum < 4) {
                     const nextRetryDate = SchedulerService.calculateNextRetry(new Date(), lastAttemptNum, lead.pais || "España");
                     await (supabase.from("intentos_llamadas" as unknown as string) as unknown as { insert: (d: unknown) => Promise<unknown> }).insert({
                         tenant_id: tenantId,
                         id_lead: leadId,
                         numero_intento: lastAttemptNum + 1,
                         fecha_reintento: nextRetryDate.toISOString(),
                         estado: "PENDIENTE",
                         tipo_intento: "LLAMADA"
                     });
                     console.log(`[POST-ANALYSIS] Scheduled retry #${lastAttemptNum + 1} for ${nextRetryDate.toISOString()}`);
                 } else {
                     // Mark lead as permanently unreachable in CRM or tag
                     console.log(`[POST-ANALYSIS] Max retries reached for lead ${leadId}`);
                 }
            }

            // 6. CRM Synchronization
            const config = await getOrchestratorConfigForTenant(tenantId);
            const crmProvider = CRMFactory.getProvider(tenantId, config);

            const updatePayload: Record<string, unknown> = {
                "Estado del lead": analysis.qualified === "si" ? "Interesado" : (analysis.qualified === "anulado" ? "Anulado" : "Ilocalizable"),
                "Motivo de estado de lead": analysis.extracted_data.motivo_anulacion || analysis.reasons,
                "Titulacion": analysis.extracted_data.titulacion_lead,
                "Experiencia": analysis.extracted_data.años_experiencia,
                "Estudios": analysis.extracted_data.nivel_estudios
            };

            await crmProvider.updateLead(lead.id_lead_externo || "", updatePayload);

            // 7. Log completion
            await (supabase.from("orchestration_logs" as unknown as string) as unknown as { insert: (d: unknown) => Promise<unknown> }).insert({
                tenant_id: tenantId,
                lead_id: leadId,
                step: 0,
                action_type: "SYSTEM",
                result: "SUCCESS",
                metadata: {
                    type: "POST_ANALYSIS",
                    channel,
                    analysis,
                    is_unproductive: isUnproductive,
                    externalId
                }
            });

            console.log(`[POST-ANALYSIS] ✅ Completed for lead ${leadId}`);
            return analysis;

        } catch (err: unknown) {
            const error = err as Error;
            console.error(`[POST-ANALYSIS] ❌ Error:`, error);
            
            // Log Failure
            await (supabase.from("orchestration_logs" as unknown as string) as unknown as { insert: (d: unknown) => Promise<unknown> }).insert({
                tenant_id: tenantId,
                lead_id: leadId,
                step: 0,
                action_type: "SYSTEM",
                result: "FAILURE",
                metadata: {
                    type: "POST_ANALYSIS",
                    error: error.message
                }
            });

            throw err;
        }
    }
}
