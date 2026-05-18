import OpenAI from "openai";
import { enqueueLeadStep } from "@/lib/core/queue/lead-sequence-queue";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { evaluateLeadQualification } from "@/lib/core/intelligence/qualifier";
import { orchestrator } from "@/lib/core/orchestrator";

interface ExtractedData {
    user_name?: string;
    nombre?: string;
    apellido?: string;
    user_phone?: string;
    qualified?: string;
    segmentacion?: string;
    estado_conversacion?: string;
    [key: string]: unknown;
}

interface LeadRecord {
    id: string;
    tenant_id: string;
    nombre: string | null;
    apellido: string | null;
    telefono: string | null;
    metadata: Record<string, unknown> | null;
}

interface TenantRecord {
    id: string;
    config: {
        segmentations?: string[];
    } | null;
}

interface AgentRecord {
    id: string;
    ai_agent_variants: Array<{
        automation_rules?: {
            finalization_criteria?: string;
        };
    }>;
}

/**
 * FACT EXTRACTION SERVICE
 * Analyzes conversation to extract structured data based on tracked variables.
 */
export class FactExtractionService {
    
    private static normalizeKey(varName: string): string {
        return varName.replace(/^\{\{|\}\}$/g, "").trim();
    }

    static async extractFromDialogue(
        leadId: string, 
        dialogue: string, 
        varsToTrack: string[],
        apiKey: string,
        tenantId?: string,
        preFilledData?: Record<string, string>,
        programRequirements?: string
    ) {
        const actualVars = varsToTrack || [];
        const normalizedKeys = actualVars.map(v => FactExtractionService.normalizeKey(v));

        console.log(`[FACT EXTRACTOR] 🧠 Extracting for lead ${leadId}: [${normalizedKeys.join(', ')}]`);

        try {
            if (!apiKey || apiKey === "your_api_key_here") {
                console.error(`[FACT EXTRACTOR] ❌ OpenAI API Key missing or invalid for lead ${leadId}`);
                return null;
            }
            const openai = new OpenAI({ apiKey });
            const supabase = await getAdminSupabaseClient();
            let validSegments = ['PUESTO 1', 'REVISADO', 'CUALIFICADO', 'SIN INTERÉS'];
            
            if (tenantId) {
                const { data: tenant } = await supabase.from("tenants")
                    .select("config")
                    .eq("id", tenantId)
                    .single() as unknown as { data: TenantRecord | null };

                if (tenant?.config?.segmentations) {
                    validSegments = tenant.config.segmentations;
                }
            }

            let finalizationRules = "El usuario se despidió, la cita quedó confirmada, o se descartó explícitamente.";
            const { data: agent } = await supabase.from("ai_agents")
                .select("id, ai_agent_variants(automation_rules)")
                .eq("tenant_id", tenantId || "")
                .eq("status", "ACTIVE")
                .limit(1)
                .maybeSingle() as unknown as { data: AgentRecord | null };
            
            const variant = agent?.ai_agent_variants?.[0];
            if (variant?.automation_rules?.finalization_criteria) {
                finalizationRules = variant.automation_rules.finalization_criteria;
            }

            const systemPrompt = `Eres un extractor de datos ultra-preciso especializado en leads para educación.
Analiza el diálogo y extrae la información relevante del perfil del lead.

CRITERIOS DE CUALIFICACIÓN ESPECÍFICOS POR PROGRAMA:
${programRequirements || "No hay criterios específicos definidos."}

CLAVES PRIORITARIAS OBLIGATORIAS: ${normalizedKeys.length > 0 ? normalizedKeys.join(', ') : 'Ninguna en particular (extrae datos generales como nombre, email, etc. si los encuentras)'}.

REGLAS CRÍTICAS:
1. Devuelve ÚNICAMENTE un JSON plano.
2. "RESUMEN_EJECUTIVO": Genera un resumen BREVE de la situación actual del lead.
3. DISCOVERY: Si encuentras otros datos útiles, inclúyelos también en el JSON.
4. NO INVENTES NADA: Si el usuario no ha mencionado algo (ej. CURSE_NAME), devuelve null. NUNCA inventes nombres de cursos.
5. "qualified": Evalúa si el lead está "SI", "NO" o "PENDIENTE".
6. "user_name": Si el usuario dice su nombre, extráelo SIEMPRE.
7. "segmentacion": DEBES elegir SOLO UNA: [${validSegments.map(s => `"${s}"`).join(', ')}].
8. "estado_conversacion": Evalúa si la conversación está "EN_CURSO" o "FINALIZADA".
    CRITERIOS PARA "FINALIZADA": ${finalizationRules}
9. REGLAS PARA VARIABLES DE QA, ESTADO Y REGLAS:
   - "ESTADO": Estado general del lead según el diálogo (ej. "Interesado", "Dudoso", "No califica", "Cita agendada").
   - "REGLA_APLICADA": La regla de cualificación que se aplicó (ej. "Experiencia laboral mínima", "Nivel de estudios", "Edad mínima", o "Sin requisitos").
   - "QA_HANDLED": "SI" si el usuario hizo preguntas y fueron respondidas, de lo contrario "NO".
   - "QA_TOPIC": El tema principal de las preguntas del usuario (ej. "Precios", "Horarios", "Becas", "Metodología"). Si no hubo preguntas, null.
10. "CURSE_NAME": NUNCA INVENTES UN CURSO. Solo extrae el curso si el usuario lo menciona explícitamente o el asistente se lo ofrece y el usuario asiente.

EJEMPLO DE SALIDA:
{"user_name": "Carlos", "RESUMEN_EJECUTIVO": "Interesado en MBA", "qualified": "SI", "segmentacion": "${validSegments[0] || 'REVISADO'}", "estado_conversacion": "FINALIZADA", "ESTADO": "Interesado", "REGLA_APLICADA": "Sin requisitos", "QA_HANDLED": "SI", "QA_TOPIC": "Precios", "CURSE_NAME": null}`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `CONVERSACIÓN:\n${dialogue}` }
                ],
                response_format: { type: "json_object" },
                temperature: 0,
                max_tokens: 400
            });

            const rawResult = completion.choices[0]?.message?.content;
            if (!rawResult) return null;

            const extractedData = JSON.parse(rawResult) as ExtractedData;
            const result: Record<string, string> = { ...(preFilledData || {}) };
            
            // Map AI extracted data to result, using normalized key names (no {{}} wrappers)
            Object.entries(extractedData).forEach(([key, val]) => {
                if (val !== undefined && val !== null && String(val).trim() !== "" && String(val).toLowerCase() !== "unknown") {
                    // Look for a case-insensitive match in tracked variables, ignoring internal spaces
                    const trackedMatch = varsToTrack.find(v => {
                        const normalizedV = FactExtractionService.normalizeKey(v).toLowerCase().replace(/\s+/g, "");
                        return normalizedV === key.toLowerCase().replace(/\s+/g, "") || v.toLowerCase().replace(/\s+/g, "") === key.toLowerCase().replace(/\s+/g, "");
                    });

                    // Always normalize the key — strip {{}} if present (avoids storing "{{REGLA_APLICADA}}" in metadata)
                    const rawKey = trackedMatch ? trackedMatch : key;
                    const finalKey = FactExtractionService.normalizeKey(rawKey);
                    result[finalKey] = String(val);
                }
            });

            // Specific handling for the summary to overwrite the long one if exists
            if (extractedData.RESUMEN_EJECUTIVO) {
                result["RESUMEN_CONVERSACION"] = String(extractedData.RESUMEN_EJECUTIVO);
            }

            if (Object.keys(result).length > 0) {
                console.log(`[FACT_EXTRACTOR] ✅ Captured facts:`, Object.keys(result));
                await FactExtractionService.saveToLeadMetadata(leadId, result);

                if (tenantId) {
                    await enqueueLeadStep({ leadId, tenantId, action: "CRM_SYNC", step: 0 });
                    
                    // Trigger Google Sheets Sync for testing/backup
                    try {
                        const { GoogleSheetsService } = await import("./google-sheets-service");
                        const { data: fullLead } = await supabase.from("lead").select("*").eq("id", leadId).single();
                        if (fullLead) {
                            await GoogleSheetsService.appendLead(tenantId, fullLead);
                        }
                    } catch (sheetErr) {
                        console.warn("[FACT_EXTRACTOR] Google Sheets sync failed:", sheetErr);
                    }

                    // Check both possible key names for conversation status (normalized and original)
                    const convStatus = (
                        result.estado_conversacion ||
                        result.CONVERSATION_STATUS ||
                        result.conversation_status ||
                        ""
                    ).toUpperCase();
                    if (convStatus === 'FINALIZADA' || convStatus === 'FINALIZADO' || convStatus === 'CLOSED') {
                        const { enqueueQualificationAnalysis } = await import("@/lib/core/queue/lead-sequence-queue");
                        await enqueueQualificationAnalysis({ leadId, tenantId, transcript: dialogue, callId: "whatsapp" });
                    }
                }
            }

            return result;
        } catch (err) {
            console.error("[FACT EXTRACTOR] ❌ Error:", err);
            if (preFilledData && Object.keys(preFilledData).length > 0) {
                await FactExtractionService.saveToLeadMetadata(leadId, preFilledData).catch(() => {});
            }
            return null;
        }
    }

    private static async saveToLeadMetadata(leadId: string, newData: Record<string, string>) {
        const supabase = await getAdminSupabaseClient();

        const { data: leadFound, error: fetchError } = await supabase.from("lead")
            .select("metadata, nombre, apellido, telefono, tenant_id")
            .eq("id", leadId)
            .single() as unknown as { data: LeadRecord | null, error: { message: string } | null };
        
        if (fetchError) {
            console.error(`[FACT_EXTRACTOR] ❌ Error fetching lead ${leadId}:`, fetchError.message);
            try {
                await supabase.from("system_logs").insert({
                    tenant_id: leadFound?.tenant_id || "00000000-0000-0000-0000-000000000000",
                    level: "ERROR",
                    message: `Error obteniendo metadatos del lead: ${fetchError.message}`,
                    metadata: { leadId, error: fetchError }
                } as never);
            } catch (logErr) {
                console.error("[FACT_EXTRACTOR] Failed to log fetch error:", logErr);
            }
            return;
        }
        
        const currentMetadata = leadFound?.metadata || {};
        const updatedMetadata = { ...currentMetadata };
        
        Object.entries(newData).forEach(([newKey, newVal]) => {
            // Find existing key by comparing lowercase and checking with/without curly braces, ignoring internal spaces
            const existingKey = Object.keys(updatedMetadata).find(k => {
                const k1 = k.toLowerCase().replace(/^\{\{|\}\}$/g, "").replace(/\s+/g, "");
                const k2 = newKey.toLowerCase().replace(/^\{\{|\}\}$/g, "").replace(/\s+/g, "");
                return k1 === k2;
            });

            if (existingKey) {
                updatedMetadata[existingKey] = newVal;
            } else {
                updatedMetadata[newKey] = newVal;
            }
        });

        updatedMetadata.last_fact_update = new Date().toISOString();
        const mainUpdate: Record<string, unknown> = { metadata: updatedMetadata };
        
        if (newData.user_name) {
            const parts = newData.user_name.trim().split(' ');
            mainUpdate.nombre = parts[0];
            if (parts.length > 1) mainUpdate.apellido = parts.slice(1).join(' ');
        }
        if (newData.nombre) {
            const parts = newData.nombre.trim().split(' ');
            mainUpdate.nombre = parts[0];
            if (parts.length > 1) mainUpdate.apellido = parts.slice(1).join(' ');
        }
        if (newData.apellido) {
            mainUpdate.apellido = newData.apellido;
        }
        if (newData.user_phone && !leadFound?.telefono) {
            mainUpdate.telefono = newData.user_phone;
        }
        if (newData.qualified) {
            const q = newData.qualified.toUpperCase();
            if (q === 'SI') mainUpdate.tipo_lead = 'CUALIFICADO';
            else if (q === 'NO') mainUpdate.tipo_lead = 'DESCARTADO';
            else if (q === 'PENDIENTE') mainUpdate.tipo_lead = 'EN SEGUIMIENTO';
        }
        if (newData.segmentacion && String(newData.segmentacion).trim() !== "") {
            mainUpdate.segmentacion = String(newData.segmentacion).trim().toUpperCase();
        }

        if (!updatedMetadata.USER_PHONE && leadFound?.telefono) {
            updatedMetadata.USER_PHONE = leadFound.telefono;
        }

        if (!updatedMetadata.USER_COUNTRY && leadFound?.telefono) {
            const phone = leadFound.telefono.replace(/\D/g, "");
            const countryMap: Record<string, string> = {
                "56": "Chile", "591": "Bolivia", "57": "Colombia", "34": "España", "52": "México",
                "54": "Argentina", "51": "Perú", "593": "Ecuador", "502": "Guatemala", "503": "El Salvador",
                "504": "Honduras", "505": "Nicaragua", "506": "Costa Rica", "507": "Panamá", "1": "USA/Canada",
            };
            for (const [prefix, country] of Object.entries(countryMap)) {
                if (phone.startsWith(prefix)) {
                    updatedMetadata.USER_COUNTRY = country;
                    break;
                }
            }
        }

        if (!updatedMetadata.USER_NAME && (leadFound?.nombre || leadFound?.apellido)) {
            updatedMetadata.USER_NAME = `${leadFound.nombre || ""} ${leadFound.apellido || ""}`.trim();
        }

        const { error: updateError } = await supabase.from("lead")
            .update(mainUpdate as never)
            .eq("id", leadId);

        if (updateError) {
            console.error(`[FACT_EXTRACTOR] ❌ Failed to save metadata:`, updateError.message);
            try {
                await supabase.from("system_logs").insert({
                    tenant_id: leadFound?.tenant_id || "00000000-0000-0000-0000-000000000000",
                    level: "ERROR",
                    message: `Error guardando metadatos del lead: ${updateError.message}`,
                    metadata: { leadId, error: updateError, mainUpdate }
                } as never);
            } catch (logErr) {
                console.error("[FACT_EXTRACTOR] Failed to log update error:", logErr);
            }
        } else {
            console.log(`[FACT EXTRACTOR] 💾 Metadata saved for lead ${leadId}`);
            
            const meta = updatedMetadata as Record<string, unknown>;
            const studies = meta.estudios || meta.nivel_estudios || meta.USER_ESTUDIES;
            const exp = meta.experiencia || meta.years_experience || meta.YEARS_EXPERIENCE || meta.YEARS_EXPERIENCIE || meta["YEARS_ EXPERIENCIE"];

            if (studies && exp) {
                const result = evaluateLeadQualification({
                    nivel_estudios: String(studies),
                    years_experience: Number(exp) || 0
                });

                if (result.status === "cualificado") {
                    const { data: lead } = await supabase.from("lead").select("tenant_id").eq("id", leadId).single() as unknown as { data: { tenant_id: string } | null };
                    if (lead) {
                        await orchestrator.handleLeadQualification(leadId, lead.tenant_id, result.reason);
                    }
                } else {
                    console.log(`[FACT_EXTRACTOR] ℹ️ Lead ${leadId} evaluated but NOT qualified yet: ${result.reason}`);
                    const { data: lead } = await supabase.from("lead").select("tenant_id").eq("id", leadId).single() as unknown as { data: { tenant_id: string } | null };
                    if (lead) {
                        await orchestrator.triggerDynamicResume(leadId, lead.tenant_id);
                    }
                }
            } else if (Object.keys(newData).length > 0) {
                const { data: lead } = await supabase.from("lead").select("tenant_id").eq("id", leadId).single() as unknown as { data: { tenant_id: string } | null };
                if (lead) await orchestrator.triggerDynamicResume(leadId, lead.tenant_id);
            }
        }
    }
}
